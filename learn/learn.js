/* LEARN 1.0 · 核心逻辑（牌堆模式）
 * - 牌堆：顶层卡可刷，后面叠 1~2 张从上缘探出，刷走后下一张顶上来
 * - 手势（纯横滑，竖滑在部分机型失灵）：左滑=下一张(看过) / 右滑=收藏
 * - 推荐：70% 兴趣 + 20% 邻近 + 10% 随机探索
 * - 行为存 localStorage（零云、零成本；后续可平滑迁 IndexedDB）
 * - 操作历史栈支持「回到上一题」，且跨刷新保留
 */
(function () {
  "use strict";
  var DATA = window.LEARN_CARDS || [];
  var byId = {};
  DATA.forEach(function (c) { byId[c.id] = c; });

  // 兴趣索引：节点标签 -> 卡片 id 列表（点节点深入用）
  var nodeIndex = {};
  DATA.forEach(function (c) {
    (c.tags || []).forEach(function (t) { (nodeIndex[t] = nodeIndex[t] || []).push(c.id); });
  });

  /* ---------- 行为存储 ---------- */
  var KEY = "rcj_learn_v1";
  var state = load();
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.interest) return s;
    } catch (e) {}
    return { seen: {}, favs: {}, skip: {}, interest: {}, history: [], path: [] };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function bumpInterest(tags, delta) {
    (tags || []).forEach(function (t) {
      state.interest[t] = (state.interest[t] || 0) + delta;
    });
  }

  /* ---------- 知识树布局（左→右 DAG 分层） ---------- */
  function layout(nodes, edges) {
    var indeg = {}; nodes.forEach(function (n) { indeg[n] = 0; });
    edges.forEach(function (e) { if (indeg[e[1]] !== undefined) indeg[e[1]]++; });
    var depth = {}; nodes.forEach(function (n) { depth[n] = indeg[n] === 0 ? 0 : -1; });
    for (var pass = 0; pass <= nodes.length; pass++) {
      edges.forEach(function (e) {
        if (depth[e[0]] >= 0 && (depth[e[1]] < 0 || depth[e[1]] < depth[e[0]] + 1)) depth[e[1]] = depth[e[0]] + 1;
      });
    }
    nodes.forEach(function (n) { if (depth[n] < 0) depth[n] = 0; });
    var cols = {};
    nodes.forEach(function (n) { (cols[depth[n]] = cols[depth[n]] || []).push(n); });
    var dep = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; });
    var maxRows = 1; dep.forEach(function (d) { maxRows = Math.max(maxRows, cols[d].length); });
    var NW = 88, NH = 30, COLW = 104, ROWH = 50, PADX = 8, PADY = 14;
    var pos = {};
    dep.forEach(function (d, ci) {
      var col = cols[d], n = col.length;
      col.forEach(function (node, ri) {
        var x = PADX + ci * COLW;
        var y = PADY + (maxRows - 1 - ri) * ROWH + ((maxRows - n) / 2) * ROWH;
        pos[node] = { x: x, y: y };
      });
    });
    var W = PADX * 2 + (dep.length - 1) * COLW + NW;
    var H = PADY * 2 + (maxRows - 1) * ROWH + NH;
    return { pos: pos, W: W, H: H, NW: NW, NH: NH };
  }

  function esc(s) { return String(s).replace(/[&<>]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]; }); }

  function renderTree(card) {
    var L = layout(card.nodes, card.edges);
    var arrow = '<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">' +
      '<path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>';
    var edgesSvg = "", nodesSvg = "";
    card.edges.forEach(function (e, i) {
      var a = L.pos[e[0]], b = L.pos[e[1]];
      if (!a || !b) return;
      var x1 = a.x + L.NW, y1 = a.y + L.NH / 2, x2 = b.x, y2 = b.y + L.NH / 2;
      var mx = (x1 + x2) / 2;
      edgesSvg += '<path class="edge" d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + (x2 - 4) + ',' + y2 +
        '" marker-end="url(#ar)" style="animation:pop .5s ' + (0.05 * i) + 's backwards"/>';
    });
    card.nodes.forEach(function (n, i) {
      var p = L.pos[n]; if (!p) return;
      var isRoot = card.edges.every(function (e) { return e[1] !== n; });
      var tx = p.x + L.NW / 2, ty = p.y + L.NH / 2;
      nodesSvg += '<g class="node-g" data-node="' + esc(n) + '" style="animation:pop .5s ' + (0.08 + 0.05 * i) + 's backwards">' +
        '<rect class="node-box' + (isRoot ? ' root' : '') + '" x="' + p.x + '" y="' + p.y + '" width="' + L.NW + '" height="' + L.NH + '" rx="9"/>' +
        '<text class="node-text" x="' + tx + '" y="' + ty + '" text-anchor="middle" dominant-baseline="central">' + esc(n) + '</text>' +
        '</g>';
    });
    return '<div class="tree-wrap"><svg viewBox="0 0 ' + L.W + ' ' + L.H + '" preserveAspectRatio="xMidYMid meet">' +
      arrow + edgesSvg + nodesSvg + '</svg></div>';
  }

  /* ---------- 推荐引擎 ---------- */
  function scoreCard(card, currentTags) {
    var interest = 0;
    (card.tags || []).forEach(function (t) { interest += (state.interest[t] || 0); });
    var prox = 0;
    if (currentTags) {
      var cur = {}; currentTags.forEach(function (t) { cur[t] = 1; });
      (card.tags || []).forEach(function (t) { if (cur[t]) prox += 1; });
    }
    var rand = Math.random();
    // 70% 兴趣 + 20% 邻近 + 10% 随机
    return 0.7 * interest + 0.2 * prox * 5 + 0.1 * rand * 10;
  }

  /* ---------- 牌堆队列 ---------- */
  var queue = [];        // 当前堆叠的卡片，queue[0] 为顶层可交互
  var queuedIds = {};    // 队列内的卡片 id
  var history = state.history || [];   // [{id, type}] 最近在前，用于「回到上一题」

  function pickForQueue() {
    var pool = DATA.filter(function (c) { return !state.seen[c.id] && !queuedIds[c.id]; });
    if (pool.length === 0) {
      // 全刷完：重置 seen 循环再来（保留 favs/interest）
      var anyLeft = DATA.some(function (c) { return !state.seen[c.id]; });
      if (!anyLeft) {
        state.seen = {}; save();
        pool = DATA.filter(function (c) { return !queuedIds[c.id]; });
      }
      if (pool.length === 0) return null;
    }
    var ctx = queue.length ? queue[queue.length - 1].tags : null;
    if (Math.random() < 0.3) return pool[Math.floor(Math.random() * pool.length)];
    var best = null, bestS = -1e9;
    pool.forEach(function (c) {
      var s = scoreCard(c, ctx) + Math.random() * 0.5; // 轻微打散
      if (s > bestS) { bestS = s; best = c; }
    });
    return best || pool[0];
  }
  function fillQueue() {
    while (queue.length < 3) {
      var c = pickForQueue();
      if (!c) break;
      queue.push(c); queuedIds[c.id] = true;
    }
  }

  /* ---------- 渲染 ---------- */
  var deck = document.getElementById("deck");
  var countEl = document.getElementById("count");
  var favBtnEl = null;
  var undoBtn = null;
  var current = null;
  var myView = document.getElementById("myView");
  var swipeView = document.getElementById("swipeView");

  function relatedChips(card) {
    var ids = card.related || [];
    if (!ids.length) return "";
    var chips = ids.filter(function (id) { return byId[id]; })
      .map(function (id) { return '<span class="rel-chip" data-go="' + id + '">' + esc(byId[id].hook.replace(/？$/, "")) + '</span>'; })
      .join("");
    return chips ? '<div class="card-related"><span class="rlabel">相关</span>' + chips + '</div>' : "";
  }

  function renderCardHTML(card, extraClass) {
    var faved = !!state.favs[card.id];
    var srcBadge = card.source ? '<span class="badge ' + (card.source.type === "official" ? "official" : "") + '">' +
      (card.source.type === "official" ? "官方" : "资料") + '</span>' : "";
    return '<div class="card ' + (extraClass || "") + '" data-id="' + card.id + '">' +
        '<div class="card-top">' +
          '<div class="card-tags">' + (card.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div>' +
          (card.source ? '<span class="card-src">' + srcBadge + esc(card.source.label) + '</span>' : '') +
        '</div>' +
        '<h2 class="card-hook">' + esc(card.hook) + '</h2>' +
        (card.misconception ? '<p class="card-mis">' + esc(card.misconception) + '</p>' : '') +
        renderTree(card) +
        (card.concept ? '<p class="card-concept">' + esc(card.concept) + '</p>' : '') +
        relatedChips(card) +
      '</div>';
  }

  function renderStack(anim) {
    current = queue[0] || null;
    var html = "";
    // 从后往前拼，使顶层最后（z 最高）
    for (var i = queue.length - 1; i >= 0; i--) {
      var cls = "depth-" + i + (i === 0 ? " top" : "");
      if (i === 0 && anim === "become") cls += " become-top";
      if (i === 0 && anim === "undo") cls += " undo-in";
      html += renderCardHTML(queue[i], cls);
    }
    deck.innerHTML = html;
    bindTop();
    updateCount();
    updateFoot();
    updateUndoBtn();
  }

  function updateCount() {
    var total = DATA.length, seen = Object.keys(state.seen).length, fav = Object.keys(state.favs).length;
    countEl.textContent = "已看 " + seen + " / " + total + " · 收藏 " + fav;
  }

  function updateFoot() {
    if (!favBtnEl) favBtnEl = document.getElementById("actFav");
    if (favBtnEl && queue.length) favBtnEl.classList.toggle("on", !!state.favs[queue[0].id]);
  }

  function updateUndoBtn() {
    if (!undoBtn) undoBtn = document.getElementById("btnUndo");
    if (undoBtn) undoBtn.disabled = history.length === 0;
  }

  /* ---------- 动作 ---------- */
  function act(type, dir) {
    if (!queue.length) return;
    var card = queue[0];
    var id = card.id;
    // 记录历史，供「回到上一题」
    history.unshift({ id: id, type: type });
    if (history.length > 60) history.length = 60;

    if (type === "seen") { state.seen[id] = 1; bumpInterest(card.tags, 1); }
    else if (type === "fav") {
      if (state.favs[id]) { delete state.favs[id]; bumpInterest(card.tags, -3); }
      else { state.favs[id] = 1; state.seen[id] = 1; bumpInterest(card.tags, 3); }
    }
    else if (type === "skip") { state.seen[id] = 1; bumpInterest(card.tags, -1); }
    state.history = history; save();

    var topEl = deck.querySelector(".card.top");
    if (topEl && dir) topEl.classList.add("out-" + dir);
    queue.shift(); delete queuedIds[id];
    fillQueue();
    setTimeout(function () { renderStack(dir ? "become" : "instant"); }, dir ? 280 : 0);
  }

  /* 回到上一题：撤销最近一次离开（看过/收藏/跳过/深入） */
  function undo() {
    if (!history.length) return;
    var last = history.shift();
    var card = byId[last.id];
    if (!card) { updateUndoBtn(); return; }
    // 反向状态
    if (last.type === "seen") { delete state.seen[card.id]; bumpInterest(card.tags, -1); }
    else if (last.type === "fav") { delete state.favs[card.id]; delete state.seen[card.id]; bumpInterest(card.tags, -3); }
    else if (last.type === "skip") { delete state.seen[card.id]; bumpInterest(card.tags, 1); }
    // type==="goto" 无状态变化，仅把离开的那张放回队首
    state.history = history; save();
    // 放回队首；队列已满则挤出最后一张（仍可被重新抽到）
    delete queuedIds[card.id];
    queue.unshift(card); queuedIds[card.id] = true;
    if (queue.length > 3) { var popped = queue.pop(); if (popped) delete queuedIds[popped.id]; }
    renderStack("undo");
  }

  function goTo(id) {
    if (!byId[id]) return;
    var prev = queue.length ? queue[0] : null;
    if (prev && prev.id === id) return;
    state.seen[id] = 1; save();
    if (prev) { history.unshift({ id: prev.id, type: "goto" }); state.history = history; save(); }
    // 若该卡已在牌堆后层，先移除旧位置
    var idx = -1;
    queue.forEach(function (c, i) { if (c.id === id) idx = i; });
    if (idx > 0) { queue.splice(idx, 1); }
    queue[0] = byId[id]; queuedIds[id] = true;
    renderStack("become");
  }

  /* ---------- 滑动手势（仅顶层卡） ---------- */
  function bindTop() {
    var el = deck.querySelector(".card.top");
    if (!el) return;
    var sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".rel-chip") || e.target.closest(".node-g")) return;
      dragging = true; sx = e.clientX; sy = e.clientY; dx = 0; dy = 0;
      el.classList.add("drag"); el.classList.remove("settle", "enter");
    });
    el.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      el.style.transform = "translate(" + dx * 0.6 + "px," + dy * 0.6 + "px) rotate(" + (dx * 0.02) + "deg)";
      el.style.opacity = String(Math.max(0.4, 1 - Math.abs(dy) / 400));
    });
    function end() {
      if (!dragging) return; dragging = false;
      el.classList.remove("drag"); el.classList.add("settle"); el.style.transform = ""; el.style.opacity = "";
      // 竖滑在部分机型失灵，改用纯横滑：左滑=下一张(看过) / 右滑=收藏
      if (dx < -55) act("seen", "left");
      else if (dx > 55) act("fav", "right");
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", function (e) { if (dragging && !e.relatedTarget) end(); });

    // 点节点深入
    el.querySelectorAll(".node-g").forEach(function (g) {
      g.addEventListener("click", function () {
        var label = g.getAttribute("data-node");
        var ids = nodeIndex[label] || [];
        var target = ids.filter(function (x) { return x !== current.id; })[0] || ids[0];
        if (target) goTo(target);
      });
    });
    // 点相关 chip
    el.querySelectorAll(".rel-chip").forEach(function (c) {
      c.addEventListener("click", function (e) {
        e.stopPropagation();
        goTo(c.getAttribute("data-go"));
      });
    });
  }

  /* ---------- 键盘兜底 ---------- */
  document.addEventListener("keydown", function (e) {
    if (myView.classList.contains("hidden") === false) return; // 在我的知识页不响应
    if (e.key === "ArrowLeft") { act("seen", "left"); }       // 左 = 下一张
    else if (e.key === "ArrowRight") { act("fav", "right"); }  // 右 = 收藏
    else if (e.key === "z" || e.key === "Z") { undo(); }       // 撤销 = 回到上一题
  });

  /* ---------- 我的知识 ---------- */
  function renderMy() {
    var favIds = Object.keys(state.favs);
    var html = '<button class="ln-btn back-btn" id="backBtn">← 返回刷</button>' +
      '<div class="my-head">我的知识</div>' +
      '<p class="my-sub">收藏的卡片会留在这里。点任意一条回到那张卡。</p>';
    var ints = Object.keys(state.interest).filter(function (k) { return state.interest[k] > 0; })
      .sort(function (a, b) { return state.interest[b] - state.interest[a]; }).slice(0, 10);
    if (ints.length) {
      html += '<div class="interest-row">' + ints.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div>';
    }
    if (!favIds.length) {
      html += '<div class="my-empty">还没有收藏。<br>刷的时候下滑（或点「收藏」）就能存下来。</div>';
    } else {
      html += '<div class="my-list">' + favIds.map(function (id) {
        var c = byId[id]; if (!c) return "";
        return '<div class="my-item" data-go="' + id + '"><div><div class="t">' + esc(c.hook) + '</div>' +
          '<div class="meta">' + (c.tags || []).map(esc).join(" · ") + '</div></div><span>→</span></div>';
      }).join("") + '</div>';
    }
    var st = myView.querySelector(".ln-stage");
    if (st) st.innerHTML = html; else myView.innerHTML = html;
    document.getElementById("backBtn").addEventListener("click", showSwipe);
    myView.querySelectorAll(".my-item").forEach(function (it) {
      it.addEventListener("click", function () { showSwipe(); goTo(it.getAttribute("data-go")); });
    });
  }

  function showSwipe() { swipeView.classList.remove("hidden"); myView.classList.add("hidden"); document.getElementById("foot").classList.remove("hidden"); }
  function showMy() { renderMy(); swipeView.classList.add("hidden"); myView.classList.remove("hidden"); document.getElementById("foot").classList.add("hidden"); }

  document.getElementById("btnSwipe").addEventListener("click", function () { showSwipe(); syncNav(); });
  document.getElementById("btnMy").addEventListener("click", function () { showMy(); syncNav(); });
  function syncNav() {
    var onSwipe = !swipeView.classList.contains("hidden");
    document.getElementById("btnSwipe").classList.toggle("on", onSwipe);
    document.getElementById("btnMy").classList.toggle("on", !onSwipe);
  }

  // 底部按钮（动画方向与横滑一致：下一张=左飞 / 收藏=右飞）
  document.getElementById("actSkip").addEventListener("click", function () { act("skip", "left"); });
  document.getElementById("actSeen").addEventListener("click", function () { act("seen", "left"); });
  document.getElementById("actFav").addEventListener("click", function () { act("fav", "right"); });
  // 回到上一题
  document.getElementById("btnUndo").addEventListener("click", undo);
  // 回到 Exam Hub（极小首页按钮）
  document.getElementById("homeMini").addEventListener("click", function () { location.href = "../index.html"; });

  /* ---------- 启动 ---------- */
  syncNav();
  fillQueue();
  renderStack("instant");
})();
