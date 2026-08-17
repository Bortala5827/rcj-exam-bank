/* 面试对练舱 · 1v1 P2P 极简面试对练
 * 架构：原生 WebRTC + Cloudflare D1 信令（不再依赖 PeerJS 云信令，国内可达/免费）。
 *       房号=房间 key，信令走 /api/rtc（D1 中转 SDP/ICE）；语音用 RTCPeerConnection 双向 addTrack。
 * 特性：URL 秒连 / 考生·考官分工 / 题库+倒计时镜面同步 / Checklist 零延迟同步
 *       / 断线自动重连 / Checklist 双向 localStorage 缓存
 */
(function () {
  "use strict";

  var qs = new URLSearchParams(location.search);
  var CITY = (qs.get("city") || "sz");
  var ROOM = (qs.get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

  // 房主判定：无 room= 即新房主；有 room= 且本地标记过“我是该房房主”则仍为房主（刷新复用）
  var HOST_MARK = "podHost_" + (ROOM || "draft");
  var IS_HOST = !ROOM ? true : (localStorage.getItem(HOST_MARK) === "1");
  var STORE_KEY = "podCache_" + (ROOM || "draft");

  var DURATION_DEFAULT = 180;
  var BASE_SCORE = 100;
  var CHECKLIST = [
    { id: "dress",    label: "着装/仪容不规范",       score: 5 },
    { id: "fluent",   label: "表达不流畅、口头禅多",  score: 5 },
    { id: "key",      label: "核心要点遗漏",          score: 10 },
    { id: "logic",    label: "逻辑混乱、条理不清",    score: 5 },
    { id: "time",     label: "超时/被叫停",           score: 5 },
    { id: "attitude", label: "态度不端正/不礼貌",      score: 10 },
    { id: "content",  label: "内容空泛、无事例支撑",   score: 5 }
  ];

  // ---------- 状态（双向缓存） ----------
  var state = {
    role: "", qIndex: -1, started: false,
    durationSec: DURATION_DEFAULT, startTs: 0, checks: {}, lastSync: 0
  };
  loadCache();

  var $ = function (id) { return document.getElementById(id); };
  var el = {};
  ["landing","room","connState","createBtn","roomNo","copyBtn","leaveBtn","roleRow","roleNow",
   "matchBtn","cancelMatchBtn","retryMatchBtn","matchToCreateBtn","matchView","matchHint",
   "candPanel","candQuestion","candTimer","candScore","candDeduct",
   "examPanel","qSelect","sendQBtn","examAnswer","durRow","durInput","startBtn","stopBtn","resetBtn","checklist","examScore",
   "micBtn","recBtn","dlBtn","voiceState","remoteAudio","localAudio","log","wxHint","toast",
   "wallPanel","wallList","wallErr","wallRefresh","wfName","wfText","wfExtra","wfMeetAt","wfContact","wfDirection","wallTabs","wfPost"
  ].forEach(function (k) { el[k] = $(k); });

  var pc = null, conn = null, myTag = "A", localStream = null, micOn = false, remoteStream = null;
  var timerInt = null, reconnectTimer = null, reconnectDelay = 1000;
  var isReconnecting = false; // 是否处于重连（setupPeer 内据此跳过重复 toast）
  // 语音混录（下载用）
  var audioCtx = null, mixedDest = null, recorder = null, recChunks = [], lastBlob = null, recOn = false;
  var mixedStreams = []; // 已接入混音的流，避免重复 connect 导致音量叠加/回声

  var pendingRole = "";                    // 匹配成功后预置的面试身份
  var connectWatchdog = null, connectStartTs = 0; // 连接超时看门狗

  // ---------- 工具 ----------
  function log(msg, cls) {
    var d = document.createElement("div");
    d.className = "log-line" + (cls ? " " + cls : "");
    d.textContent = "[" + new Date().toLocaleTimeString() + "] " + msg;
    el.log.appendChild(d);
    el.log.scrollTop = el.log.scrollHeight;
  }
  function toast(msg) {
    el.toast.textContent = msg; el.toast.classList.add("show");
    setTimeout(function () { el.toast.classList.remove("show"); }, 2200);
  }
  function setConn(text, cls) {
    el.connState.textContent = text;
    el.connState.className = "pod-conn " + (cls || "");
  }
  function genRoom() {
    var s = "", chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (var i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function saveCache() {
    try { state.lastSync = Date.now(); localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function loadCache() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && typeof o === "object") {
        state.role = o.role || "";
        state.qIndex = (typeof o.qIndex === "number") ? o.qIndex : -1;
        state.started = !!o.started;
        state.durationSec = o.durationSec || DURATION_DEFAULT;
        state.startTs = o.startTs || 0;
        state.checks = o.checks || {};
      }
    } catch (e) {}
  }

  // ---------- 数据传输（经 RTCDataChannel，JSON 字符串） ----------
  function send(obj) {
    if (conn && conn.readyState === "open") { try { conn.send(JSON.stringify(obj)); } catch (e) {} }
  }
  function onData(raw) {
    var data;
    try { data = (typeof raw === "string") ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (!data || !data.t) return;
    switch (data.t) {
      case "hello":
        if (state.role === "examiner") sendState();
        break;
      case "req":
        if (state.role === "examiner") sendState();
        break;
      case "renego":
        if (IS_HOST) makeOffer(); // 访客开了麦克风，房主负责重新协商
        break;
      case "state":
        if (state.role === "candidate") applyState(data.state);
        break;
      case "q":
        if (state.role === "candidate") { state.qIndex = data.i; showCandQuestion(); saveCache(); }
        break;
      case "start":
        if (state.role === "candidate") {
          state.started = true; state.durationSec = data.durationSec; state.startTs = data.startTs;
          startCandidateTimer(); saveCache();
        }
        break;
      case "stop":
        if (state.role === "candidate") { state.started = false; stopCandidateTimer(); el.candTimer.textContent = "已结束"; saveCache(); }
        break;
      case "check":
        if (state.role === "candidate") { state.checks[data.id] = !!data.on; updateCandScore(); saveCache(); }
        break;
      case "reset":
        if (state.role === "candidate") { state.checks = {}; updateCandScore(); saveCache(); }
        break;
    }
  }
  function sendState() {
    send({ t: "state", state: {
      qIndex: state.qIndex, started: state.started,
      durationSec: state.durationSec, startTs: state.startTs, checks: state.checks
    }});
  }
  function applyState(s) {
    if (!s) return;
    state.qIndex = (typeof s.qIndex === "number") ? s.qIndex : state.qIndex;
    state.started = !!s.started;
    state.durationSec = s.durationSec || state.durationSec;
    state.startTs = s.startTs || state.startTs;
    state.checks = s.checks || {};
    showCandQuestion(); updateCandScore();
    if (state.started) startCandidateTimer(); else stopCandidateTimer();
    saveCache();
  }

  // ---------- 倒计时（考生端，基于共享 startTs 同步） ----------
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }
  function startCandidateTimer() {
    stopCandidateTimer();
    timerInt = setInterval(function () {
      var remain = state.durationSec - (Date.now() - state.startTs) / 1000;
      if (remain <= 0) { el.candTimer.textContent = "00:00 · 时间到"; stopCandidateTimer(); }
      else el.candTimer.textContent = fmt(remain);
    }, 250);
  }
  function stopCandidateTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }

  // ---------- 评分 ----------
  function calcScore(checks) {
    var d = 0;
    CHECKLIST.forEach(function (c) { if (checks[c.id]) d += c.score; });
    return Math.max(0, BASE_SCORE - d);
  }
  function updateCandScore() {
    var sc = calcScore(state.checks);
    el.candScore.textContent = sc;
    var items = CHECKLIST.filter(function (c) { return state.checks[c.id]; });
    el.candDeduct.textContent = items.length
      ? ("已扣：" + items.map(function (c) { return c.label + "(-" + c.score + ")" }).join("、"))
      : "暂无扣分";
  }
  function renderChecklist() {
    el.checklist.innerHTML = "";
    CHECKLIST.forEach(function (c) {
      var row = document.createElement("label"); row.className = "ck-row";
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = !!state.checks[c.id];
      cb.addEventListener("change", function () {
        state.checks[c.id] = cb.checked;
        updateExamScore(); updateCandScore(); saveCache();
        send({ t: "check", id: c.id, on: cb.checked });
      });
      var span = document.createElement("span");
      span.textContent = c.label + "（-" + c.score + "）";
      row.appendChild(cb); row.appendChild(span);
      el.checklist.appendChild(row);
    });
    updateExamScore();
  }
  function updateExamScore() { el.examScore.textContent = calcScore(state.checks); }

  // ---------- 题库 ----------
  var QUESTIONS = [];
  function qText(q) { return ((q && (q.title || q.stem)) || "").replace(/<[^>]+>/g, ""); }
  function qAns(q) { return ((q && (q.answer || q.a)) || "").replace(/<[^>]+>/g, ""); }
  function loadQuestions(cb) {
    var s = document.createElement("script");
    s.src = "../" + CITY + "/station-data.js?pod=" + Date.now();
    s.onload = function () {
      try { QUESTIONS = (window.DATA_INTERVIEW || []).slice(); } catch (e) {}
      cb();
    };
    s.onerror = function () { cb(); };
    document.head.appendChild(s);
  }
  function renderQuestionOptions() {
    el.qSelect.innerHTML = "";
    if (!QUESTIONS.length) {
      var o = document.createElement("option"); o.textContent = "（未加载到题库）"; el.qSelect.appendChild(o); return;
    }
    QUESTIONS.forEach(function (q, i) {
      var o = document.createElement("option");
      o.value = i;
      var t = qText(q);
      o.textContent = (i + 1) + ". " + (t.length > 26 ? t.slice(0, 26) + "…" : t);
      el.qSelect.appendChild(o);
    });
  }
  function showCandQuestion() {
    if (state.qIndex >= 0 && QUESTIONS[state.qIndex]) {
      el.candQuestion.textContent = qText(QUESTIONS[state.qIndex]);
    } else {
      el.candQuestion.textContent = "等待考官发题…";
    }
  }
  function showExamAnswer() {
    var i = (typeof el.qSelect.value === "string") ? parseInt(el.qSelect.value, 10) : el.qSelect.value;
    if (QUESTIONS[i]) {
      el.examAnswer.textContent = qAns(QUESTIONS[i]);
      el.examAnswer.classList.remove("empty");
    } else {
      el.examAnswer.textContent = "选择题目后，此处显示参考答案（供你对照评分）";
      el.examAnswer.classList.add("empty");
    }
  }

  // ---------- 身份分工 ----------
  function setRole(role) {
    state.role = role; saveCache();
    el.roleRow.style.display = "none";
    el.roleNow.style.display = "block";
    el.roleNow.innerHTML = "你的身份：<b>" + (role === "examiner" ? "🎓 考官" : "🙋 考生") +
      "</b> <button class=\"link-btn\" id=\"switchRole\">切换</button>";
    $("switchRole").addEventListener("click", function () {
      state.role = ""; saveCache();
      el.roleRow.style.display = "flex"; el.roleNow.style.display = "none";
      el.candPanel.style.display = "none"; el.examPanel.style.display = "none";
    });
    if (role === "examiner") {
      el.examPanel.style.display = "block"; el.candPanel.style.display = "none";
      renderChecklist(); markDurActive(); showExamAnswer();
      if (state.qIndex >= 0) showCandQuestion();
      updateExamScore();
    } else {
      el.candPanel.style.display = "block"; el.examPanel.style.display = "none";
      showCandQuestion(); updateCandScore();
      if (state.started) startCandidateTimer();
    }
    send({ t: "hello", role: role });
    if (role === "candidate") send({ t: "req" });
    else sendState();
  }
  function markDurActive() {
    Array.prototype.forEach.call(el.durRow.querySelectorAll(".dur-btn"), function (x) {
      var d = parseInt(x.getAttribute("data-d"), 10);
      var on = d === state.durationSec;
      x.classList.toggle("active", on);
      if (on && el.durInput) el.durInput.value = (d / 60);
    });
  }

  // ---------- 麦克风 / 语音呼叫 ----------
  function startMic() {
    if (micOn) { toast("麦克风已开启"); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast("当前环境不支持麦克风（建议系统浏览器打开）"); return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
      localStream = stream; el.localAudio.srcObject = stream;
      micOn = true; el.voiceState.textContent = "已开启"; el.micBtn.textContent = "🎤 麦克风已开";
      log("麦克风已开启");
      if (audioCtx) connectToMix(localStream); // 若已在录音，把本地语音接进混音
      addLocalTracks(); // 把本地麦克风轨道加入 P2P 连接（房主触发重协商；访客通知房主）
      try { if (!IS_HOST && conn && conn.readyState === "open") send({ t: "renego" }); } catch (e) {}
    }).catch(function (e) {
      toast("无法开启麦克风：" + (e && e.message ? e.message : e));
      log("麦克风失败：" + (e && e.message ? e.message : e), "err");
    });
  }

  // ---------- 原生 WebRTC 连接 ----------
  function iceServers() {
    // 公共 STUN + 免费 TURN fallback，提高国内 NAT 穿透成功率（含 Cloudflare STUN，国内可达性好）
    return [
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun.miwifi.com:3478" },
      { urls: "stun:stun.qq.com:3478" },
      { urls: "stun:stun.baidu.com:3478" },
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
    ];
  }
  function isWechatBrowser() {
    var ua = navigator.userAgent || "";
    return /MicroMessenger/i.test(ua) || /wxwork/i.test(ua);
  }
  function showWxHint() {
    if (isWechatBrowser()) {
      el.wxHint.innerHTML = "⚠️ 检测到微信内置浏览器，WebRTC 语音很可能被限制。<br>请点右上角 <b>⋯ → 在浏览器打开</b>（Safari / Chrome），否则无法连上搭子。";
      el.wxHint.classList.add("warn");
    }
  }
  function startConnectWatchdog() {
    connectStartTs = Date.now();
    if (connectWatchdog) clearTimeout(connectWatchdog);
    connectWatchdog = setTimeout(function () {
      // 数据通道已打开或 P2P 已连通，不算超时
      if (conn && conn.readyState === "open") return;
      if (pc && pc.connectionState === "connected") return;
      // 房主仍在等访客加入，提示等待而非超时
      if (IS_HOST && pc && (pc.connectionState === "new" || pc.connectionState === "connecting")) {
        log("仍在等待搭子加入房间…");
        setConn("等待搭子加入…", "warn");
        // 再等 20 秒，若仍未连上再报超时
        connectWatchdog = setTimeout(function () {
          if (conn && conn.readyState === "open") return;
          if (pc && pc.connectionState === "connected") return;
          log("连接超时，建议换网络或浏览器", "err");
          setConn("连接超时", "err");
          showConnectFailTip();
        }, 20000);
        return;
      }
      log("连接超时，建议换网络或浏览器", "err");
      setConn("连接超时", "err");
      showConnectFailTip();
    }, 10000);
  }
  function showConnectFailTip() {
    var tip = isWechatBrowser()
      ? "微信内 WebRTC 受限，请点右上角 ⋯ → 在浏览器打开。"
      : "请尝试：① 切换 4G/5G 或 Wi-Fi；② 换 Safari/Chrome；③ 让房主刷新重开房间。";
    el.wxHint.innerHTML = "⚠️ " + tip;
    el.wxHint.classList.add("warn");
  }
  function clearConnectWatchdog() {
    if (connectWatchdog) { clearTimeout(connectWatchdog); connectWatchdog = null; }
  }

  // ---------- 原生 WebRTC + D1 信令（不再依赖 PeerJS 云信令） ----------
  function setupPeer() {
    showWxHint();
    startConnectWatchdog();
    var wasReconnect = isReconnecting;
    myTag = IS_HOST ? "A" : "B";
    sigSince = 0;
    var cfg = { iceServers: iceServers() };
    try { pc = new RTCPeerConnection(cfg); } catch (e) {
      log("无法创建 WebRTC 连接：" + e, "err"); setConn("连接异常", "err"); return;
    }
    if (localStream) addLocalTracks();
    if (IS_HOST) {
      try { conn = pc.createDataChannel("pod", { ordered: true }); bindDataChannel(conn); } catch (e) {}
    } else {
      pc.ondatachannel = function (ev) { conn = ev.channel; bindDataChannel(conn); };
    }
    pc.onicecandidate = function (e) {
      if (e && e.candidate) postSignal("ice", (e.candidate.toJSON ? e.candidate.toJSON() : e.candidate));
    };
    pc.ontrack = function (e) {
      remoteStream = e.streams && e.streams[0];
      el.remoteAudio.srcObject = remoteStream;
      if (audioCtx) connectToMix(remoteStream);
      log("已收到对方语音");
    };
    pc.onconnectionstatechange = function () {
      var st = pc.connectionState;
      if (st === "connected") { setConn("已连接", "ok"); clearConnectWatchdog(); log("P2P 连接已建立"); }
      else if (st === "connecting") { setConn("建立连接中…", "warn"); }
      else if (st === "disconnected") { setConn("连接中断，重连中…", "err"); log("连接中断", "err"); scheduleReconnect(); }
      else if (st === "failed") { setConn("连接失败，请重开房间", "err"); log("连接失败", "err"); }
    };
    // 房主是 offerer：仅在有媒体轨道时才重新协商（初始空 offer 由下方 makeOffer 发出）
    pc.onnegotiationneeded = function () {
      if (!IS_HOST) return;
      var hasTrack = false;
      try { hasTrack = pc.getSenders().some(function (s) { return s.track; }); } catch (e) {}
      if (!hasTrack) return;
      makeOffer();
    };

    if (IS_HOST) {
      ROOM = ROOM || genRoom();
      STORE_KEY = "podCache_" + ROOM; HOST_MARK = "podHost_" + ROOM;
      try { localStorage.setItem(HOST_MARK, "1"); } catch (e) {}
      loadCache();
      if (!wasReconnect) {
        if (pendingRole) { setRole(pendingRole); pendingRole = ""; }
        else if (state.role) setRole(state.role);
        el.roomNo.textContent = ROOM;
        var url = "?room=" + ROOM + (CITY !== "sz" ? "&city=" + CITY : "");
        history.replaceState(null, "", url);
        toast("房间已创建：" + ROOM + "，把链接发给搭子");
      }
      makeOffer(); // 房主立即发 offer（先建数据通道，音频待开麦后重协商）
    } else {
      el.roomNo.textContent = ROOM || "------";
    }
    startSignalingLoop();
    isReconnecting = false;
  }

  var makingOffer = false, sigSince = 0, sigTimer = null, sigStopped = false, pendingIce = [];
  function makeOffer() {
    if (!pc || makingOffer) return;
    makingOffer = true;
    pc.createOffer().then(function (offer) { return pc.setLocalDescription(offer); })
      .then(function () { return postSignal("offer", pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription); })
      .catch(function (e) { log("生成 offer 失败：" + e, "err"); })
      .finally(function () { makingOffer = false; });
  }
  function addLocalTracks() {
    if (!pc || !localStream) return;
    localStream.getTracks().forEach(function (t) { try { pc.addTrack(t, localStream); } catch (e) {} });
  }
  function postSignal(type, payload) {
    if (!ROOM) return;
    fetch("/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: ROOM, tag: myTag, type: type, payload: payload })
    }).catch(function () {});
  }
  function startSignalingLoop() {
    if (sigTimer) return;
    sigStopped = false;
    sigTimer = setInterval(fetchSignal, 2500);
  }
  function stopSignalingLoop() {
    sigStopped = true;
    if (sigTimer) { clearInterval(sigTimer); sigTimer = null; }
  }
  function fetchSignal() {
    if (sigStopped || !ROOM) return;
    fetch("/api/rtc?room=" + encodeURIComponent(ROOM) + "&tag=" + myTag + "&since=" + sigSince, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) return;
        (d.signals || []).forEach(function (s) { applySignal(s); });
        if (d.seq && d.seq > sigSince) sigSince = d.seq;
      })
      .catch(function () {});
  }
  function applySignal(s) {
    if (!pc) return;
    var RS = window.RTCSessionDescription || RTCSessionDescription;
    var RIC = window.RTCIceCandidate || RTCIceCandidate;
    if (s.type === "offer") {
      pc.setRemoteDescription(new RS(s.payload))
        .then(function () { return pc.createAnswer(); })
        .then(function (ans) { return pc.setLocalDescription(ans); })
        .then(function () { return postSignal("answer", pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription); })
        .then(flushIce)
        .catch(function (e) { log("处理 offer 失败：" + e, "err"); });
    } else if (s.type === "answer") {
      pc.setRemoteDescription(new RS(s.payload)).then(flushIce).catch(function (e) { log("处理 answer 失败：" + e, "err"); });
    } else if (s.type === "ice") {
      // 远端描述尚未就绪时先缓存，待 setRemoteDescription 完成再补加（避免丢候选）
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try { pc.addIceCandidate(new RIC(s.payload)); } catch (e) {}
      } else {
        pendingIce.push(s.payload);
      }
    }
  }
  function flushIce() {
    if (!pendingIce.length) return;
    var list = pendingIce; pendingIce = [];
    list.forEach(function (c) { try { pc.addIceCandidate(new (window.RTCIceCandidate || RTCIceCandidate)(c)); } catch (e) {} });
  }
  function bindDataChannel(c) {
    c.onopen = function () {
      setConn("已连接", "ok"); log("数据通道已打开"); clearConnectWatchdog();
      if (pendingRole) { setRole(pendingRole); pendingRole = ""; }
      else {
        if (state.role) send({ t: "hello", role: state.role });
        if (state.role === "candidate") send({ t: "req" });
        else if (state.role === "examiner") sendState();
      }
    };
    c.onmessage = function (e) { onData(e.data); };
    c.onclose = function () {
      setConn("对端断开，重连中…", "err"); log("数据通道关闭", "err");
      conn = null; scheduleReconnect();
    };
    c.onerror = function () { log("数据通道错误", "err"); };
  }
  function teardownRTC() {
    stopSignalingLoop();
    try { if (conn && conn.close) conn.close(); } catch (e) {}
    try { if (pc && pc.close) pc.close(); } catch (e) {}
    pc = null; conn = null;
  }
  function scheduleReconnect() {
    if (reconnectTimer) return;
    isReconnecting = true;
    reconnectDelay = Math.min(reconnectDelay * 1.6, 8000);
    var delay = reconnectDelay;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      log("尝试重建连接（延迟 " + delay + "ms）");
      startConnectWatchdog();
      teardownRTC();
      setupPeer();
    }, delay);
  }
  function leaveRoom() {
    stopRecording();
    clearConnectWatchdog();
    stopSignalingLoop();
    teardownRTC();
    isReconnecting = false;
    try { localStorage.removeItem(HOST_MARK); } catch (e) {}
    if (localStream) { localStream.getTracks().forEach(function (t) { t.stop(); }); localStream = null; }
    remoteStream = null; micOn = false;
    if (audioCtx) { try { audioCtx.suspend(); } catch (e) {} }
    mixedStreams = [];
    el.micBtn.textContent = "🎤 开启麦克风"; el.voiceState.textContent = "未开启";
    el.room.style.display = "none"; el.landing.style.display = "block";
    setConn("未连接", "");
    log("已离开房间");
  }

  // ---------- 考官控制 ----------
  function bindControls() {
    el.sendQBtn.addEventListener("click", function () {
      if (!QUESTIONS.length) { toast("题库未加载"); return; }
      state.qIndex = parseInt(el.qSelect.value, 10) || 0;
      showCandQuestion(); showExamAnswer(); saveCache();
      send({ t: "q", i: state.qIndex });
      toast("已发题给搭子");
    });
    el.qSelect.addEventListener("change", function () { showExamAnswer(); });
    Array.prototype.forEach.call(el.durRow.querySelectorAll(".dur-btn"), function (b) {
      b.addEventListener("click", function () {
        state.durationSec = parseInt(b.getAttribute("data-d"), 10);
        markDurActive(); saveCache();
      });
    });
    // 自定义时长：输入框直接决定 state.durationSec（不局限于预设）
    if (el.durInput) {
      el.durInput.addEventListener("input", function () {
        var v = parseFloat(el.durInput.value);
        if (!isFinite(v) || v <= 0) return;
        state.durationSec = Math.round(v * 60);
        Array.prototype.forEach.call(el.durRow.querySelectorAll(".dur-btn"), function (x) {
          x.classList.toggle("active", parseInt(x.getAttribute("data-d"), 10) === state.durationSec);
        });
        saveCache();
      });
    }
    el.startBtn.addEventListener("click", function () {
      state.started = true; state.startTs = Date.now();
      el.startBtn.style.display = "none"; el.stopBtn.style.display = "inline-block";
      send({ t: "start", durationSec: state.durationSec, startTs: state.startTs });
      saveCache();
      toast("已开始，考生端倒计时同步启动");
    });
    el.stopBtn.addEventListener("click", function () {
      state.started = false;
      el.startBtn.style.display = "inline-block"; el.stopBtn.style.display = "none";
      send({ t: "stop" }); saveCache();
    });
    el.resetBtn.addEventListener("click", function () {
      state.checks = {}; renderChecklist(); updateCandScore(); saveCache();
      send({ t: "reset" });
      toast("评分已重置");
    });
    el.micBtn.addEventListener("click", startMic);
    el.recBtn.addEventListener("click", toggleRecording);
    el.dlBtn.addEventListener("click", downloadRecording);
    el.leaveBtn.addEventListener("click", leaveRoom);
    el.matchBtn.addEventListener("click", enterLobby);
    el.cancelMatchBtn.addEventListener("click", leaveLobby);
    if (el.retryMatchBtn) el.retryMatchBtn.addEventListener("click", function () { leaveLobby(); enterLobby(); });
    if (el.matchToCreateBtn) el.matchToCreateBtn.addEventListener("click", function () {
      leaveLobby();
      el.landing.style.display = "none";
      el.room.style.display = "block";
      setupPeer();
    });
    // 留言墙 / 约练
    el.wfPost.addEventListener("click", postWall);
    el.wallRefresh.addEventListener("click", fetchWall);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="wfType"]'), function (r) {
      r.addEventListener("change", function () {
        var t = document.querySelector('input[name="wfType"]:checked');
        el.wfExtra.style.display = (t && t.value === "meet") ? "block" : "none";
      });
    });
    bindWallControls();
    el.copyBtn.addEventListener("click", function () {
      var url = location.origin + location.pathname + "?room=" + ROOM + (CITY !== "sz" ? "&city=" + CITY : "");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast("链接已复制，发给搭子"); },
          function () { toast(url); });
      } else { toast(url); }
    });
    Array.prototype.forEach.call(document.querySelectorAll(".role-btn"), function (b) {
      b.addEventListener("click", function () { setRole(b.getAttribute("data-role")); });
    });
  }

  // ---------- 随机匹配大厅（D1 集中撮合，不再依赖 PeerJS 大厅 P2P） ----------
  var lobbyActive = false, lobbyEntered = false, lobbyTicket = "", lobbyPollTimer = null, matchHintTimer = null;
  function showMatchView() {
    el.landing.style.display = "none"; el.room.style.display = "none";
    el.matchView.style.display = "block";
    updateMatchHint("系统正在为你寻找在线练习伙伴，通常几秒到几十秒。");
    if (matchHintTimer) { clearTimeout(matchHintTimer); matchHintTimer = null; }
    matchHintTimer = setTimeout(function () {
      if (lobbyActive) updateMatchHint("暂时没找到伙伴，可继续等待，或点下方「创建房间」发链接给熟人。");
    }, 30000);
  }
  function updateMatchHint(text) {
    if (el.matchHint) el.matchHint.textContent = text;
  }
  function clearLobbyTimers() {
    if (lobbyPollTimer) { clearInterval(lobbyPollTimer); lobbyPollTimer = null; }
    if (matchHintTimer) { clearTimeout(matchHintTimer); matchHintTimer = null; }
  }
  function enterLobby() {
    lobbyActive = true; lobbyEntered = false; lobbyTicket = "";
    clearLobbyTimers();
    showMatchView();
    updateMatchHint("正在接入匹配大厅…");
    setConn("正在匹配…", "warn");
    // 需要先有一个 PeerJS id 作为身份；复用 setupPeer 里的 peer 或临时建一个
    ensureLobbyId().then(function (pid) {
      if (!lobbyActive) return;
      if (!pid) {
        updateMatchHint("无法获取匹配身份，建议点「创建房间」把链接发给熟人练习。");
        setConn("匹配失败", "err");
        return;
      }
      log("匹配身份=" + pid);
      fetch("/api/signal?action=join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ city: CITY, peerId: pid })
      }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (!lobbyActive) return;
          if (!d.ok) {
            if (d.error === "DB_NOT_BOUND") updateMatchHint("匹配服务未启用（D1 未绑定），建议点「创建房间」发链接给熟人。");
            else updateMatchHint("匹配服务暂时繁忙，建议点「创建房间」发链接给熟人练习。");
            setConn("匹配失败", "err");
            return;
          }
          if (d.matched) {
            updateMatchHint("已找到伙伴，正在进入房间…");
            enterLobbySession({ room: d.room, isHost: d.isHost, role: d.role });
          } else {
            lobbyTicket = d.ticket;
            updateMatchHint("已登记，等待搭子加入…");
            log("已登记匹配大厅，ticket=" + d.ticket);
            startLobbyPolling();
          }
        })
        .catch(function (e) {
          if (!lobbyActive) return;
          log("匹配大厅加入失败：" + (e && e.message), "err");
          updateMatchHint("匹配服务当前不太稳定，建议点「创建房间」把链接发给熟人练习。");
          setConn("匹配失败", "err");
        });
    });
  }
  // 匹配大厅身份：本地随机 id 即可，D1 撮合完全不依赖 PeerJS cloud
  function genLobbyId() {
    return "u" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }
  function ensureLobbyId() {
    return new Promise(function (resolve) { resolve(genLobbyId()); });
  }
  var lobbyPollMiss = 0; // 连续未读到 match 次数
  function startLobbyPolling() {
    clearLobbyTimers();
    lobbyPollMiss = 0;
    lobbyPollTimer = setInterval(function () {
      if (!lobbyActive || !lobbyTicket) return;
      fetch("/api/signal?action=poll&city=" + encodeURIComponent(CITY) + "&ticket=" + encodeURIComponent(lobbyTicket), { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!lobbyActive) return;
          if (d.matched) {
            updateMatchHint("已找到伙伴，正在进入房间…");
            enterLobbySession({ room: d.room, isHost: d.isHost, role: d.role });
            return;
          }
          lobbyPollMiss++;
          // 等待池条目可能已被配对方移除，但 match 结果因 D1 写入延迟未到；
          // 继续 poll match，而不是重新 join，避免破坏已配对状态。
          if (lobbyPollMiss % 4 === 0) {
            log("仍在等待搭子…（" + lobbyPollMiss + " 次轮询）");
          }
          if (lobbyPollMiss >= 12) {
            // 约 30 秒仍未同步，大概率是配对未真正完成或 D1 读不到，提示用户手动重试
            updateMatchHint("配对结果同步较慢，建议点「取消」后重新匹配，或「创建房间」发链接给熟人。");
          }
        })
        .catch(function (e) {
          if (!lobbyActive) return;
          log("轮询失败：" + (e && e.message), "err");
        });
    }, 2500);
  }
  function enterLobbySession(enter) {
    if (!enter || lobbyEntered) return;
    lobbyEntered = true; lobbyActive = false;
    clearLobbyTimers();
    startSession(enter.room, enter.isHost, enter.role);
  }
  function leaveLobby() {
    lobbyActive = false; lobbyEntered = false;
    var t = lobbyTicket; lobbyTicket = "";
    clearLobbyTimers();
    stopRecording();
    if (t) {
      fetch("/api/signal?action=cancel&city=" + encodeURIComponent(CITY) + "&ticket=" + encodeURIComponent(t), { method: "POST" })
        .catch(function () {});
    }
    if (audioCtx) { try { audioCtx.suspend(); } catch (e) {} }
    mixedStreams = [];
    el.matchView.style.display = "none"; el.landing.style.display = "block";
    setConn("未连接", "");
  }
  function startSession(room, isHost, role) {
    ROOM = room; IS_HOST = !!isHost;
    STORE_KEY = "podCache_" + room; HOST_MARK = "podHost_" + room;
    try { if (isHost) localStorage.setItem(HOST_MARK, "1"); else localStorage.removeItem(HOST_MARK); } catch (e) {}
    pendingRole = role || "";
    el.matchView.style.display = "none"; el.landing.style.display = "none";
    el.room.style.display = "block";
    el.wxHint.innerHTML = "📌 微信内点开可能不支持语音，可点右上角 ⋯ 选「在浏览器打开」。<br>🔊 双方都点一下「开启麦克风」才能互相听到。";
    setupPeer();
  }

  // ---------- 语音混录 + 下载 ----------
  function ensureAudioCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      mixedDest = audioCtx.createMediaStreamDestination();
    }
    if (audioCtx.state === "suspended") { try { audioCtx.resume(); } catch (e) {} }
    return audioCtx;
  }
  function connectToMix(stream) {
    if (!stream || !audioCtx || !mixedDest) return;
    if (mixedStreams.indexOf(stream) >= 0) return; // 已接入则跳过，避免同一路声音被重复叠加
    mixedStreams.push(stream);
    try { audioCtx.createMediaStreamSource(stream).connect(mixedDest); } catch (e) {}
  }
  function startRecording() {
    if (recOn) return;
    if (!ensureAudioCtx()) { toast("当前浏览器不支持录音"); return; }
    if (localStream) connectToMix(localStream);
    if (remoteStream) connectToMix(remoteStream);
    if (!mixedDest || !mixedDest.stream) { toast("还没有语音可录（先开双方麦克风）"); return; }
    try {
      recChunks = [];
      var mr = new MediaRecorder(mixedDest.stream);
      mr.ondataavailable = function (e) { if (e.data && e.data.size) recChunks.push(e.data); };
      mr.onstop = function () {
        try { lastBlob = new Blob(recChunks, { type: (recChunks[0] && recChunks[0].type) || "audio/webm" }); } catch (e) {}
        recOn = false; el.recBtn.classList.remove("rec-on"); el.recBtn.textContent = "⏺ 录音";
        if (lastBlob && lastBlob.size) toast("录音已就绪，点📥下载");
      };
      mr.start();
      recorder = mr; recOn = true;
      el.recBtn.classList.add("rec-on"); el.recBtn.textContent = "⏹ 停止录音";
      toast("开始录音（混合双方语音）");
    } catch (e) { toast("录音启动失败：" + (e && e.message ? e.message : e)); }
  }
  function stopRecording() {
    if (recorder && recorder.state === "recording") { try { recorder.stop(); } catch (e) {} }
  }
  function toggleRecording() { if (recOn) stopRecording(); else startRecording(); }
  function downloadRecording() {
    if (!lastBlob || !lastBlob.size) { toast("还没有可下载的录音（先点⏺录音）"); return; }
    var ext = (lastBlob.type.indexOf("mp4") >= 0) ? "mp4" : "webm";
    var url = URL.createObjectURL(lastBlob);
    var a = document.createElement("a");
    var ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url; a.download = "面试对练录音_" + (ROOM || "pod") + "_" + ts + "." + ext;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
  }

  // ---------- 留言墙 / 约练（D1 后端） ----------
  var wallTimer = null;
  var lastWallItems = [];
  var wallFilter = "all";
  var respondedIds = (function () {
    try { return JSON.parse(localStorage.getItem("pod_responded") || "[]"); } catch (e) { return []; }
  })();
  function myUid() {
    var u = "";
    try { u = localStorage.getItem("pod_uid"); } catch (e) {}
    if (!u) { u = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); try { localStorage.setItem("pod_uid", u); } catch (e) {} }
    return u;
  }
  function rememberResponded(id) {
    if (respondedIds.indexOf(id) < 0) {
      respondedIds.push(id);
      try { localStorage.setItem("pod_responded", JSON.stringify(respondedIds)); } catch (e) {}
    }
  }
  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function relTime(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + "秒前";
    if (s < 3600) return Math.floor(s / 60) + "分钟前";
    if (s < 86400) return Math.floor(s / 3600) + "小时前";
    return Math.floor(s / 86400) + "天前";
  }
  function fmtMeetISO(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var p = function (n) { return (n < 10 ? "0" + n : "" + n); };
    return (d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function isExpired(iso) {
    if (!iso) return false;
    var d = new Date(iso);
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
  }
  function renderWall(items) {
    lastWallItems = items || [];
    el.wallList.innerHTML = "";
    var list = lastWallItems.filter(function (it) { return wallFilter === "all" || it.type === wallFilter; });
    if (!list.length) {
      el.wallList.innerHTML = '<div class="wall-empty">' +
        (lastWallItems.length ? "该分类下还没有内容，切换或发一条吧～" : "还没有留言，来发第一条吧～") + '</div>';
      return;
    }
    list.forEach(function (it) {
      var d = document.createElement("div"); d.className = "wall-item";
      if (it.type === "meet" && isExpired(it.meetAtISO)) d.className += " wi-expired";
      var badge = it.type === "meet"
        ? '<span class="wi-badge meet">约练</span>'
        : '<span class="wi-badge msg">留言</span>';
      var meta = "";
      if (it.type === "meet") {
        var m = [];
        if (it.meetAtISO) m.push("⏰ " + escapeHtml(fmtMeetISO(it.meetAtISO)) + (isExpired(it.meetAtISO) ? "（已过期）" : ""));
        else if (it.meetAt) m.push("⏰ " + escapeHtml(it.meetAt));
        if (it.direction) m.push("🎯 " + escapeHtml(it.direction));
        if (it.contact) m.push("📞 " + escapeHtml(it.contact));
        if (m.length) meta = '<div class="wi-meta">' + m.join("　") + "</div>";
      } else if (it.contact) {
        meta = '<div class="wi-meta">📞 ' + escapeHtml(it.contact) + "</div>";
      }
      var respHtml = "";
      if (it.type === "meet") {
        var cnt = it.resp || 0;
        var mine = respondedIds.indexOf(it.id) >= 0;
        respHtml = '<button class="wi-resp' + (mine ? " done" : "") + '" data-id="' + it.id + '">' +
          (mine ? "已响应✓ " : "🙋 我想一起 ") + "(" + cnt + ")</button>";
      }
      d.innerHTML =
        '<div class="wi-top">' + badge +
        '<span class="wi-name">' + escapeHtml(it.name) + '</span>' +
        '<span class="wi-time">' + relTime(it.createdAt) + '</span>' +
        '<span class="wi-del" title="删除">✕</span></div>' +
        '<div class="wi-text">' + escapeHtml(it.text) + '</div>' + meta + respHtml;
      d.querySelector(".wi-del").addEventListener("click", function () { deleteWall(it.id); });
      if (it.type === "meet") {
        d.querySelector(".wi-resp").addEventListener("click", function () { respondWall(it.id); });
      }
      el.wallList.appendChild(d);
    });
  }
  function applyWallFilter() { renderWall(lastWallItems); }
  function showWallErr(msg) { el.wallErr.textContent = msg; el.wallErr.style.display = "block"; }
  function fetchWall() {
    fetch("/api/wall?city=" + encodeURIComponent(CITY), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) { el.wallErr.style.display = "none"; renderWall(d.items); }
        else if (d.error === "DB_NOT_BOUND") {
          showWallErr("留言墙存储未启用：请在 Cloudflare 后台把 D1 数据库绑定到函数（绑定名 DB）。");
        } else { showWallErr("留言墙加载失败，稍后点刷新重试。"); }
      })
      .catch(function () { showWallErr("留言墙加载失败（网络），稍后点刷新重试。"); });
  }
  function postWall() {
    var t = document.querySelector('input[name="wfType"]:checked');
    var type = t ? t.value : "msg";
    var text = el.wfText.value.trim();
    if (!text) { toast("先写点内容"); return; }
    var meetAtISO = "";
    if (type === "meet" && el.wfMeetAt.value) {
      var dt = new Date(el.wfMeetAt.value);
      if (!isNaN(dt.getTime())) meetAtISO = dt.toISOString();
    }
    var payload = {
      city: CITY, type: type, action: "post",
      name: el.wfName.value.trim(),
      text: text,
      meetAt: (type === "meet") ? (fmtMeetISO(meetAtISO) || el.wfMeetAt.value) : "",
      meetAtISO: meetAtISO,
      direction: (type === "meet") ? el.wfDirection.value : "",
      contact: el.wfContact.value.trim()
    };
    el.wfPost.disabled = true; el.wfPost.textContent = "发布中…";
    fetch("/api/wall", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        el.wfPost.disabled = false; el.wfPost.textContent = "发布到留言墙";
        if (d.ok) {
          el.wfText.value = ""; el.wfMeetAt.value = ""; el.wfDirection.value = "";
          toast("已发布到留言墙"); fetchWall();
        } else if (d.error === "DB_NOT_BOUND") {
          showWallErr("留言墙存储未启用：请在 Cloudflare 后台绑定 D1（DB）。");
        } else if (d.error === "RATE_LIMIT") {
          toast("发帖太频繁，请 " + (d.left || 60) + " 秒后再发");
        } else if (d.error === "DAILY_LIMIT") {
          toast("今日发帖已达上限（20 条/天），明天再来～");
        } else if (d.error === "DUP") {
          toast("刚才发过相同内容啦，稍等会儿再发");
        } else if (d.error === "BAD_WORD") {
          toast("内容含敏感词，已拦截");
        } else { toast("发布失败：" + (d.error || "未知错误")); }
      })
      .catch(function () { el.wfPost.disabled = false; el.wfPost.textContent = "发布到留言墙"; toast("发布失败（网络）"); });
  }
  function respondWall(id) {
    if (respondedIds.indexOf(id) >= 0) { toast("你已经响应过这条啦"); return; }
    fetch("/api/wall", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ city: CITY, action: "respond", id: id, uid: myUid() })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          rememberResponded(id);
          toast("已响应，当前 " + (d.resp || 0) + " 人想一起");
          fetchWall();
        } else if (d.error === "NOT_FOUND") { toast("该约练已不存在"); fetchWall(); }
        else toast("响应失败：" + (d.error || "未知"));
      })
      .catch(function () { toast("响应失败（网络）"); });
  }
  function bindWallControls() {
    try {
      el.wfName.value = localStorage.getItem("pod_wfName") || "";
      el.wfContact.value = localStorage.getItem("pod_wfContact") || "";
    } catch (e) {}
    el.wfName.addEventListener("input", function () { try { localStorage.setItem("pod_wfName", el.wfName.value.trim()); } catch (e) {} });
    el.wfContact.addEventListener("input", function () { try { localStorage.setItem("pod_wfContact", el.wfContact.value.trim()); } catch (e) {} });
    Array.prototype.forEach.call(document.querySelectorAll("#wallTabs .tab"), function (b) {
      b.addEventListener("click", function () {
        wallFilter = b.getAttribute("data-f") || "all";
        Array.prototype.forEach.call(document.querySelectorAll("#wallTabs .tab"), function (x) { x.classList.toggle("active", x === b); });
        applyWallFilter();
      });
    });
  }
  function deleteWall(id) {
    var pwd = prompt("删除该留言需输入口令（见页面底部备注）：", "");
    if (pwd === null) return;
    fetch("/api/wall?city=" + encodeURIComponent(CITY) + "&id=" + encodeURIComponent(id) + "&admin=" + encodeURIComponent(pwd), { method: "DELETE" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) { toast("已删除"); fetchWall(); }
        else if (d.error === "BAD_ADMIN") toast("口令错误，无法删除");
        else if (d.error === "NOT_FOUND") { toast("该留言已不存在"); fetchWall(); }
        else toast("删除失败：" + (d.error || "未知错误"));
      })
      .catch(function () { toast("删除失败（网络）"); });
  }

  // ---------- 初始化 ----------
  function init() {
    if (ROOM) {
      IS_HOST = (localStorage.getItem(HOST_MARK) === "1"); // 刷新后可能是房主
      el.landing.style.display = "none";
      el.room.style.display = "block";
      el.roomNo.textContent = ROOM;
      el.wxHint.innerHTML = "📌 微信内点开可能不支持语音，可点右上角 ⋯ 选「在浏览器打开」。<br>🔊 双方都点一下「开启麦克风」才能互相听到。";
      setupPeer();
    } else {
      el.landing.style.display = "block";
      el.room.style.display = "none";
      el.createBtn.addEventListener("click", function () {
        el.landing.style.display = "none";
        el.room.style.display = "block";
        el.wxHint.innerHTML = "📌 微信内点开可能不支持语音，可点右上角 ⋯ 选「在浏览器打开」。<br>🔊 双方都点一下「开启麦克风」才能互相听到。";
        setupPeer();
      });
    }
    bindControls();
    // 留言墙：进入即加载，落地页可见时每 20s 自动刷新（在房间内不浪费请求）
    fetchWall();
    if (wallTimer) clearInterval(wallTimer);
    wallTimer = setInterval(function () {
      if (el.landing.style.display !== "none") fetchWall();
    }, 20000);
    loadQuestions(function () {
      renderQuestionOptions();
      if (state.role) setRole(state.role); // 刷新后恢复身份与打分进度
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
