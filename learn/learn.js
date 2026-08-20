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

  /* ---------- My take 引导弹窗(用户多次刷卡后,提示跳结构化即兴表达) ----------
   * - 触发:累计刷 8~14 张首次,之后每 6~11 张再触发一次,同 session 最多 3 次
   * - session = 本次页面加载,跨刷新重置(避免骚扰)
   * - 用户点了主按钮跳转 → 同 session 静默不再弹(已行动)
   * - 用户点"先存着"或 ✕ → 算一次弹过,继续计数
   * - 阈值随机化:首次 8~14 随机,之后增量 6~11 随机,避免每次都在第10/18/26张弹 */
  var sessionSwipeCount = 0;     // 本次页面加载累计刷卡数(act + goTo 都算)
  var sessionPromptShown = 0;    // 本次页面加载已弹窗次数
  var sessionNextPromptAt = 8 + Math.floor(Math.random() * 7);  // 首次 8~14 随机
  var sessionPromptSilent = false; // 用户已跳转行动过,本 session 静默
  var PROMPT_MAX = 3;            // 每 session 最多弹几次

  function countSwipe(curId) {
    if (sessionPromptSilent) return;
    if (promptToastEl) return;     // 已在显示,不重入
    if (sessionPromptShown >= PROMPT_MAX) return;
    sessionSwipeCount++;
    if (sessionSwipeCount >= sessionNextPromptAt) {
      showPromptToast(curId);
    }
  }

  function showPromptToast(cardId) {
    var card = byId[cardId];
    if (!card) card = queue[0];
    if (!card) return;
    sessionPromptShown++;
    // 下次阈值:当前计数 + 6~11 随机增量
    sessionNextPromptAt = sessionSwipeCount + 6 + Math.floor(Math.random() * 6);

    // 只创建一次容器,之后复用
    if (!promptToastEl) {
      promptToastEl = document.createElement("div");
      promptToastEl.id = "mytakeToast";
      promptToastEl.setAttribute("role", "dialog");
      promptToastEl.setAttribute("aria-label", "即兴表达引导");
      document.body.appendChild(promptToastEl);
      // ✕ 按钮(只绑一次)
      promptToastEl.addEventListener("click", function (e) {
        var t = e.target;
        if (t.closest(".mytake-close")) hidePromptToast();
        else if (t.closest(".mytake-secondary")) hidePromptToast();
        else if (t.closest(".mytake-primary")) {
          // 跳转结构化,带 hash 参数
          var cur = promptToastEl.getAttribute("data-card") || "";
          if (cur) {
            sessionPromptSilent = true;   // 已行动,本 session 静默
            hidePromptToast();
            location.href = "../structured.html#learn?card=" + encodeURIComponent(cur);
          } else {
            hidePromptToast();
          }
        }
      });
    }
    // hook 截断到 24 字,避免一行太长
    var hookShort = card.hook && card.hook.length > 24
      ? card.hook.slice(0, 24) + "…"
      : (card.hook || "这张");
    var cardTags = (card.tags || []).slice(0, 2).map(function (t) {
      return '<span class="mytake-tag">' + esc(t) + '</span>';
    }).join("");
    promptToastEl.setAttribute("data-card", card.id);
    promptToastEl.innerHTML =
      '<div class="mytake-inner">' +
        '<button class="mytake-close" aria-label="关闭">✕</button>' +
        '<div class="mytake-kicker">刷得挺认真啊 · 换个形式试试</div>' +
        '<div class="mytake-tags">' + cardTags + '</div>' +
        '<div class="mytake-hook">' + esc(hookShort) + '</div>' +
        '<div class="mytake-sub">光看记不住，开口讲一遍才是你的。去结构化练习里录个音，存个 1.0 版本的理解。</div>' +
        '<div class="mytake-actions">' +
          '<button class="mytake-secondary">先存着，继续刷</button>' +
          '<button class="mytake-primary">🎤 就这张，讲讲看</button>' +
        '</div>' +
      '</div>';
    // 触发动画(下一帧再加 .show,确保 transition 生效)
    promptToastEl.classList.remove("show");
    requestAnimationFrame(function () {
      promptToastEl.classList.add("show");
    });
  }

  function hidePromptToast() {
    if (!promptToastEl) return;
    promptToastEl.classList.remove("show");
    // 动画结束后不清空 DOM,下次 showPromptToast 会重写 innerHTML
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.interest) {
        // 旧版本可能存了未用的 path 字段,清理掉避免脏数据
        if ('path' in s) delete s.path;
        return s;
      }
    } catch (e) {}
    return { seen: {}, favs: {}, skip: {}, interest: {}, history: [] };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function bumpInterest(tags, delta) {
    (tags || []).forEach(function (t) {
      state.interest[t] = (state.interest[t] || 0) + delta;
    });
  }

  /* ---------- 知识树布局（左→右 DAG 分层 + 蛇形折行） ---------- */
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

    var NW = 88, NH = 30, COLW = 104, ROWH = 50, PADX = 8, PADY = 14;
    var MAXC = 4;   // 每行最多 4 列，超出蛇形折行（让链式卡不再超宽扁）

    var maxNodes = 1;
    dep.forEach(function (d) { maxNodes = Math.max(maxNodes, cols[d].length); });
    var rowCount = Math.ceil(dep.length / MAXC);
    var rowH = maxNodes * ROWH + 12;   // 行高（含行间留白）

    var pos = {};
    dep.forEach(function (d, di) {
      var row = Math.floor(di / MAXC);
      var c = di % MAXC;
      var col = cols[d];
      // 蛇形：偶数行左→右，奇数行右→左
      var x = PADX + (row % 2 === 0 ? c : (MAXC - 1 - c)) * COLW;
      col.forEach(function (node, ri) {
        // 列内垂直居中，整体对称
        var y = PADY + row * rowH + (maxNodes - col.length) * ROWH / 2 + ri * ROWH;
        pos[node] = { x: x, y: y };
      });
    });

    var maxCols = Math.min(dep.length, MAXC);
    var W = PADX * 2 + (maxCols - 1) * COLW + NW;
    var H = PADY * 2 + (rowCount - 1) * rowH + maxNodes * ROWH;
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
      var d = "";
      if (Math.abs(a.x - b.x) < 1) {
        // 同列跨行（蛇形折行处）：从 a 底部垂直连到 b 顶部
        var vx = a.x + L.NW / 2;
        var vy1 = a.y + L.NH;
        var vy2 = b.y;
        d = 'M' + vx + ',' + vy1 + ' C' + vx + ',' + ((vy1 + vy2) / 2) + ' ' + vx + ',' + ((vy1 + vy2) / 2) + ' ' + vx + ',' + vy2;
      } else if (b.x < a.x) {
        // b 在 a 左侧（蛇形反向行）：a 左边缘 → b 右边缘
        var lx1 = a.x, ly1 = a.y + L.NH / 2, lx2 = b.x + L.NW, ly2 = b.y + L.NH / 2;
        var lmx = (lx1 + lx2) / 2;
        d = 'M' + lx1 + ',' + ly1 + ' C' + lmx + ',' + ly1 + ' ' + lmx + ',' + ly2 + ' ' + (lx2 + 4) + ',' + ly2;
      } else {
        var x1 = a.x + L.NW, y1 = a.y + L.NH / 2, x2 = b.x, y2 = b.y + L.NH / 2;
        var mx = (x1 + x2) / 2;
        d = 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + (x2 - 4) + ',' + y2;
      }
      edgesSvg += '<path class="edge" d="' + d + '" marker-end="url(#ar)" style="animation:pop .5s ' + (0.05 * i) + 's backwards"/>';
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
    return '<div class="tree-wrap" style="aspect-ratio:' + L.W + ' / ' + L.H + '"><svg viewBox="0 0 ' + L.W + ' ' + L.H + '" preserveAspectRatio="xMidYMid meet">' +
      arrow + edgesSvg + nodesSvg + '</svg></div>';
  }

  /* ---------- 推荐引擎：认知补全（沿知识路径走，而非猜你喜欢） ----------
   * 优化点（2026-08-20）：
   * 1. interest 加成按 tag 数归一化,避免 tag 多的卡被多加 4-5 次
   * 2. 孤立卡(被 related 引用次数 = 0)给基础加成,避免沉底
   * 3. 有 misconception 的卡小幅加成(它们多是有反差/反常识的拉力卡)
   */
  var inRelCount = {};   // 被其他卡 related 引用的次数,用于识别孤立卡
  DATA.forEach(function (c) {
    (c.related || []).forEach(function (id) { inRelCount[id] = (inRelCount[id] || 0) + 1; });
  });

  function scoreCard(card, anchor) {
    var s = 0;
    if (anchor) {
      // 显式关联（related）= 最高权重：这是人工设计的「下一块拼图」
      var rel = anchor.related || [];
      if (rel.indexOf(card.id) >= 0) s += 6;
      // tags 邻近：补充同维度的相邻视角
      var cur = {};
      (anchor.tags || []).forEach(function (t) { cur[t] = 1; });
      var prox = 0;
      (card.tags || []).forEach(function (t) { if (cur[t]) prox += 1; });
      s += prox * 1.5;
    }
    // 兴趣加成（历史行为,弱权重）— 按 tag 数归一化,避免 tag 多的卡吃红利
    var tagList = card.tags || [];
    var interestSum = 0;
    tagList.forEach(function (t) { interestSum += (state.interest[t] || 0); });
    if (tagList.length) s += (interestSum / tagList.length) * 0.3;
    // 孤立卡加成：无人 related 指向的卡,基础加一点,避免长期沉底
    if (!inRelCount[card.id]) s += 1.5;
    // 反差卡加成：有 misconception 字段 = 有"你以为...其实..."的反差,推前一点
    if (card.misconception) s += 0.8;
    return s;
  }

  /* ---------- 牌堆队列 ---------- */
  var queue = [];        // 当前堆叠的卡片，queue[0] 为顶层可交互
  var queuedIds = {};    // 队列内的卡片 id
  var history = state.history || [];   // [{id, type}] 最近在前，用于「回到上一题」

  function pickForQueue() {
    // 优先：未看过 且 不在队列里的卡
    var pool = DATA.filter(function (c) { return !state.seen[c.id] && !queuedIds[c.id]; });
    if (pool.length === 0) {
      // 兜底：不在队列里的所有卡（含已看过），保证牌堆始终能补满 3 张
      pool = DATA.filter(function (c) { return !queuedIds[c.id]; });
      if (pool.length === 0) return null;
      // 若确实全部看完，重置 seen 开启新一轮（保留 favs/interest）
      var anyUnseen = DATA.some(function (c) { return !state.seen[c.id]; });
      if (!anyUnseen) { state.seen = {}; save(); }
    }
    // 锚点：顶层卡（当前正在看的），沿它的 related/tags 补下一块拼图
    var anchor = queue.length ? queue[0] : null;
    // 12% 随机探索，打破路径依赖（用户可打乱）;原 20% 偏高，会频繁打断知识路径
    if (Math.random() < 0.12) return pool[Math.floor(Math.random() * pool.length)];
    var best = null, bestS = -1e9;
    pool.forEach(function (c) {
      var s = scoreCard(c, anchor) + Math.random() * 1.2; // 轻微打散，避免死循环
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
  var prevBtn = null;
  var current = null;
  var myView = document.getElementById("myView");
  var swipeView = document.getElementById("swipeView");
  /* === 瀑布流视图 + 详情 modal（2026-08-20 新增）=== */
  var feedView = document.getElementById("feedView");
  var feedFilterEl = document.getElementById("feedFilter");
  var feedGrid = document.getElementById("feedGrid");
  var feedEnd = document.getElementById("feedEnd");
  var detailModal = document.getElementById("detailModal");
  var detailBody = document.getElementById("detailBody");
  var detailFavBtn = null;
  var currentFilter = "all";       // all / unseen / faved
  var currentDetailId = null;     // modal 当前展示的卡片 id

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
          '<div class="card-side">' +
            (card.source ? '<span class="card-src">' + srcBadge + esc(card.source.label) + '</span>' : '') +
            '<span class="card-star' + (faved ? ' on' : '') + '" data-fav="' + card.id + '" title="' + (faved ? '取消收藏' : '收藏') + '">' + (faved ? '★' : '☆') + '</span>' +
          '</div>' +
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
    updatePrevBtn();
  }

  function updateCount() {
    var total = DATA.length, seen = Object.keys(state.seen).length, fav = Object.keys(state.favs).length;
    countEl.textContent = "已看 " + seen + " / " + total + " · 收藏 " + fav;
  }

  function updateFoot() {
    if (!favBtnEl) favBtnEl = document.getElementById("actFav");
    if (favBtnEl && queue.length) favBtnEl.classList.toggle("on", !!state.favs[queue[0].id]);
  }

  function updatePrevBtn() {
    if (!prevBtn) prevBtn = document.getElementById("actPrev");
    if (prevBtn) prevBtn.disabled = history.length === 0;
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
    // 牌堆刷卡计数,用于触发 My take 引导弹窗
    // 下一张顶卡 id 传进去(这是 toast 里要显示"就这张,讲讲看"的那张)
    setTimeout(function () {
      renderStack(dir ? "become" : "instant");
      var next = queue[0];
      if (next) countSwipe(next.id);
    }, dir ? 280 : 0);
  }

  /* 回到上一题：撤销最近一次离开（看过/收藏/跳过/深入） */
  function undo() {
    if (!history.length) return;
    var last = history.shift();
    var card = byId[last.id];
    if (!card) { updatePrevBtn(); return; }
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
    // 点节点/相关卡跳转也算一次刷卡
    if (prev && prev.id !== id) countSwipe(id);
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
      // 手势：下划=收藏 / 左滑=下一张(看过) / 右滑=上一张 / 上滑=下一张
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 55) {
        if (dy > 0) act("fav", "down");      // 下划 = 收藏
        else act("seen", "up");               // 上滑 = 下一张
      } else if (Math.abs(dx) > 55) {
        if (dx < 0) act("seen", "left");      // 左滑 = 下一张
        else undo();                          // 右滑 = 上一张
      }
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", function (e) { if (dragging && !e.relatedTarget) end(); });

    // 点节点深入
    el.querySelectorAll(".node-g").forEach(function (g) {
      g.addEventListener("click", function () {
        var label = g.getAttribute("data-node");
        // 优先：卡片显式指定的节点跳转（nodeLinks 映射节点文字 → 卡片 id）
        var explicit = current && current.nodeLinks && current.nodeLinks[label];
        if (explicit && byId[explicit]) { goTo(explicit); return; }
        // 回退：按 tag 索引
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
    // 点星星收藏/取消收藏
    el.querySelectorAll(".card-star").forEach(function (s) {
      s.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleFav(current.id);
      });
    });
  }

  // 仅切换收藏状态（不移动卡片），刷新星星 + 底部收藏按钮
  function toggleFav(id) {
    var card = byId[id];
    if (!card) return;
    if (state.favs[id]) { delete state.favs[id]; bumpInterest(card.tags, -3); }
    else { state.favs[id] = 1; state.seen[id] = 1; bumpInterest(card.tags, 3); }
    save();
    var topEl = deck.querySelector(".card.top");
    if (topEl) {
      var star = topEl.querySelector(".card-star");
      var on = !!state.favs[id];
      if (star) {
        star.classList.toggle("on", on);
        star.textContent = on ? "★" : "☆";
        star.title = on ? "取消收藏" : "收藏";
      }
    }
    updateFoot();
    updateCount();
  }

  /* ============ 瀑布流视图 + 详情 modal（2026-08-20）============
   * - 顶部 chips 筛选：全部 / 未看过 / 已收藏（带计数,实时反映进度）
   * - 双列 CSS columns 真瀑布流,卡片按 hook 字数自然变高
   * - 卡片状态反馈：未看过→NEW 红点 / 看过→轻微淡化 / 已收藏→金色边框
   * - 点击卡片打开底部弹出详情 modal,复用 renderCardHTML 展示完整知识图谱
   * - modal 底部按钮：收藏/取消、在牌堆里刷（切到牌堆视图并 goTo 该卡）
   */
  function renderFeedFilter() {
    var unseenCount = DATA.filter(function (c) { return !state.seen[c.id]; }).length;
    var favedCount = Object.keys(state.favs).length;
    var chips = [
      { key: "all",    label: "全部",   count: DATA.length },
      { key: "unseen", label: "未看过", count: unseenCount },
      { key: "faved", label: "已收藏", count: favedCount }
    ];
    feedFilterEl.innerHTML = chips.map(function (c) {
      return '<button class="feed-chip' + (c.key === currentFilter ? " on" : "") +
        '" data-filter="' + c.key + '">' + c.label +
        '<span class="cnt">' + c.count + '</span></button>';
    }).join("");
    feedFilterEl.querySelectorAll(".feed-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        currentFilter = b.getAttribute("data-filter");
        renderFeedFilter();
        renderFeed();
      });
    });
  }

  /* 懒加载分批渲染：避免一次塞 30 张 DOM 引起的卡顿
   * - 首批 8 张,后续每滚到底附近补 6 张
   * - IntersectionObserver 监视哨兵元素,触发追加
   * - 切换筛选/视图时取消旧 observer,避免泄漏 */
  var feedList = [];          // 当前筛选+排序后的完整列表
  var feedRenderedCount = 0;  // 已渲染数量
  var feedSentinel = null;    // 哨兵元素(放在 feedGrid 外,避免被 columns 布局吞掉)
  var feedObserver = null;
  var FEED_BATCH = 12;
  var FEED_MORE = 8;

  /* ---------- 瀑布流卡片:4 种数据驱动卡型,概率+特征混合分配 ----------
   *  注:本批数据里 hook 几乎全是 13–20 字短问句,纯按 hook_len 会"一刀切"
   *  策略:ID hash → 概率分配 + 数据特征兜底(有什么特性就偏什么卡型)
   *  目标比例:poster 20% / rich 25% / mis 30% / base 25%
   *  type-poster: 大字报 → 柔和彩色底 + hook 居中大字 + 标签下沉居中
   *  type-rich:   全标签长卡 → tagCount≥3 的卡,高留白 + 圆润 22 圆角 + 显示上限 4 标签
   *  type-mis:    反差辟谣卡 → 有 misconception,灰框"你以为…"+ 主 hook 前加渐变"其实"
   *  type-base:   其余 → 标准白卡,约 35% 走 tight(更紧凑小号),制造高度差 */
  function pickCardType(c) {
    var hookLen = (c.hook || '').length;
    var tagCount = (c.tags || []).length;
    var sid = c.id || ('x' + hookLen);
    var h = 0; for (var i = 0; i < sid.length; i++) h = ((h * 41) + sid.charCodeAt(i)) >>> 0;
    var r = h % 100; // 0-99

    // 精确概率桶:poster 20% / rich 25% / mis 30% / base 25%
    // 数据特征不满足就降级到相邻的、不需要额外数据的类型
    if (r < 20) return 'poster';
    if (r < 45) return (tagCount >= 3) ? 'rich' : 'poster';
    if (r < 75) return c.misconception ? 'mis' : ((tagCount >= 3) ? 'rich' : 'base');
    return 'base';
  }
  // 字符串 → 柔和 HSL 背景色 (97~98% 亮度,65~75% 饱和度),用于大字报卡的彩色底
  function softBgStyle(seed) {
    var s = '' + (seed || 'x');
    var h = 0; for (var i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
    var hue = h % 360;
    return 'background:hsl(' + hue + ',70%,97.8%);';
  }

  function renderFeedCardHTML(c) {
    var seen = !!state.seen[c.id];
    var faved = !!state.favs[c.id];
    var isNew = !seen;
    var type = pickCardType(c);

    // 标签显示数量:rich 全量(上限 4),其他上限 2
    var tagLimit = (type === 'rich') ? 4 : 2;
    var tags = (c.tags || []).slice(0, tagLimit).map(function (t) {
      return '<span class="feed-card-tag">' + esc(t) + '</span>';
    }).join("");

    var srcBadge = c.source ? '<span class="badge ' + (c.source.type === "official" ? "official" : "") + '">' +
      (c.source.type === "official" ? "官方" : "资料") + '</span>' : "";
    var srcLabel = c.source ? '<span class="src-label">' + esc(c.source.label) + '</span>' : "";

    // base 卡 ~30% 概率走紧凑版 tight(更小 padding + 小号字,制造高度落差)
    var tight = '';
    if (type === 'base') {
      var r = 0; var s2 = c.id || ('x' + Math.random());
      for (var k = 0; k < s2.length; k++) r = ((r * 17) + s2.charCodeAt(k)) >>> 0;
      if ((r % 10) < 3) tight = ' feed-type-base-tight';
    }

    var cls = ' feed-type-' + type + tight;
    var attrs = ' class="feed-card' + (seen ? " seen" : "") + (faved ? " faved" : "") + cls + '" data-id="' + c.id + '"';

    var newDot = (isNew ? '<span class="feed-new" title="未看过"></span>' : '');
    var starBtn = '<span class="feed-card-star' + (faved ? " on" : "") + '" data-fav="' + c.id +
      '" title="' + (faved ? "取消收藏" : "收藏") + '">' + (faved ? "★" : "☆") + '</span>';
    var srcLine = (c.source ? '<span class="feed-card-src">' + srcBadge + srcLabel + '</span>' : '<span></span>') + starBtn;

    if (type === 'poster') {
      // 大字报:柔和彩色底 + 标签下移居中 + hook 居中大字
      var style = ' style="' + softBgStyle((c.tags && c.tags[0]) || c.id) + '"';
      return '<div' + attrs + style + '>' +
        (newDot ? '<div class="feed-card-top"><span></span>' + newDot + '</div>' : '') +
        '<h3 class="feed-card-hook">' + esc(c.hook) + '</h3>' +
        (tags ? '<div class="feed-card-tags feed-tags-center">' + tags + '</div>' : '') +
        '<div class="feed-card-bot">' + srcLine + '</div>' +
      '</div>';
    }

    if (type === 'mis') {
      // 反差卡:上面灰框"你以为…" + 下面 hook "其实…"
      return '<div' + attrs + '>' +
        '<div class="feed-card-top">' +
          '<div class="feed-card-tags">' + tags + '</div>' +
          newDot +
        '</div>' +
        '<div class="feed-mis-block">' +
          '<span class="feed-mis-label">你以为</span>' +
          '<p class="feed-mis-text">' + esc(c.misconception) + '</p>' +
        '</div>' +
        '<h3 class="feed-card-hook feed-hook-mis">' + esc(c.hook) + '</h3>' +
        '<div class="feed-card-bot">' + srcLine + '</div>' +
      '</div>';
    }

    // rich / base 共用结构,只靠 class 改变外观
    return '<div' + attrs + '>' +
      '<div class="feed-card-top">' +
        '<div class="feed-card-tags">' + tags + '</div>' +
        newDot +
      '</div>' +
      '<h3 class="feed-card-hook">' + esc(c.hook) + '</h3>' +
      '<div class="feed-card-bot">' + srcLine + '</div>' +
    '</div>';
  }

  function bindFeedCardEvents(el) {
    el.addEventListener("click", function (e) {
      if (e.target.closest(".feed-card-star")) return;
      openDetail(el.getAttribute("data-id"));
    });
    var s = el.querySelector(".feed-card-star");
    if (s) {
      s.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = s.getAttribute("data-fav");
        toggleFav(id);
        var now = !!state.favs[id];
        var card = s.closest(".feed-card");
        card.classList.toggle("faved", now);
        card.classList.toggle("seen", !!state.seen[id]);  // 收藏会顺手 mark seen
        s.classList.toggle("on", now);
        s.textContent = now ? "★" : "☆";
        s.title = now ? "取消收藏" : "收藏";
        // 当前是"已收藏"筛选且取消了 → 立刻重渲整列(因为列表变了)
        if (currentFilter === "faved" && !now) renderFeed();
        // 当前是"未看过"筛选且新增了收藏(顺手 seen) → 立刻重渲
        if (currentFilter === "unseen" && now) renderFeed();
        renderFeedFilter();  // 计数刷新
      });
    }
  }

  function appendFeedBatch() {
    if (feedRenderedCount >= feedList.length) {
      // 全部渲染完
      if (feedEnd) feedEnd.textContent = "共 " + feedList.length + " 张 · 刷到底了";
      if (feedObserver) { feedObserver.disconnect(); feedObserver = null; }
      return;
    }
    var frag = document.createDocumentFragment();
    var end = Math.min(feedRenderedCount + (feedRenderedCount === 0 ? FEED_BATCH : FEED_MORE), feedList.length);
    for (var i = feedRenderedCount; i < end; i++) {
      var div = document.createElement("div");
      div.innerHTML = renderFeedCardHTML(feedList[i]);
      var cardEl = div.firstChild;
      bindFeedCardEvents(cardEl);
      frag.appendChild(cardEl);
    }
    feedRenderedCount = end;
    // 哨兵放在 feedGrid 之外(feedEnd 之前),避免被 columns 布局吞掉
    if (feedSentinel && feedSentinel.parentNode) feedSentinel.parentNode.removeChild(feedSentinel);
    feedGrid.appendChild(frag);
    if (feedRenderedCount < feedList.length) {
      if (!feedSentinel) {
        feedSentinel = document.createElement("div");
        feedSentinel.className = "feed-sentinel";
        feedSentinel.setAttribute("aria-hidden", "true");
      }
      // 哨兵插在 feedGrid 之后、feedEnd 之前(在 feedView 内,但不在 columns 容器里)
      if (feedEnd && feedEnd.parentNode === feedGrid.parentNode) {
        feedGrid.parentNode.insertBefore(feedSentinel, feedEnd);
      } else {
        feedGrid.parentNode.appendChild(feedSentinel);
      }
      if (feedObserver) feedObserver.observe(feedSentinel);
      if (feedEnd) feedEnd.textContent = "";   // 渲染中,不显示"刷到底"
    } else {
      if (feedEnd) feedEnd.textContent = "共 " + feedList.length + " 张 · 刷到底了";
    }
  }

  function renderFeed() {
    feedList = DATA.slice();
    if (currentFilter === "unseen") {
      feedList = feedList.filter(function (c) { return !state.seen[c.id]; });
    } else if (currentFilter === "faved") {
      feedList = feedList.filter(function (c) { return state.favs[c.id]; });
    }
    // 排序：未看过靠前 > 已收藏靠前 > 其他,让浏览时新内容先映入眼帘
    feedList.sort(function (a, b) {
      var aSeen = state.seen[a.id] ? 1 : 0;
      var bSeen = state.seen[b.id] ? 1 : 0;
      if (aSeen !== bSeen) return aSeen - bSeen;
      var aFav = state.favs[a.id] ? 1 : 0;
      var bFav = state.favs[b.id] ? 1 : 0;
      return bFav - aFav;
    });

    // 清理旧 observer
    if (feedObserver) { feedObserver.disconnect(); feedObserver = null; }

    feedGrid.innerHTML = "";
    feedRenderedCount = 0;

    if (feedList.length === 0) {
      if (feedEnd) {
        var empty = currentFilter === "unseen" ? "都看过了,去牌堆刷一轮?" :
                    currentFilter === "faved" ? "还没收藏。刷到喜欢的卡点 ☆ 留下来。" : "暂无卡片。";
        feedEnd.innerHTML = '<div class="feed-empty">' + empty + '</div>';
      }
      return;
    }
    if (feedEnd) feedEnd.innerHTML = "";

    // 初始化 IntersectionObserver 懒加载
    // root 必须设为 feed-stage(滚动容器),否则 root:null 看视口,哨兵被 stage 外元素遮挡永远不可见
    var feedStage = feedView.querySelector(".feed-stage");
    if ("IntersectionObserver" in window && feedStage) {
      feedObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) appendFeedBatch();
        });
      }, { root: feedStage, rootMargin: "80px 0px", threshold: 0 });
    }
    // 首批立即渲染,无 observer 时一次性全渲(降级)
    appendFeedBatch();
    if (!feedObserver && feedRenderedCount < feedList.length) appendFeedBatch();
  }

  function openDetail(id) {
    var card = byId[id];
    if (!card) return;
    currentDetailId = id;
    // 复用牌堆的 renderCardHTML,不带牌堆专用 class(top/depth/drag)
    detailBody.innerHTML = renderCardHTML(card, "");
    if (!detailFavBtn) detailFavBtn = document.getElementById("detailFav");
    var faved = !!state.favs[id];
    detailFavBtn.classList.toggle("on", faved);
    detailFavBtn.textContent = faved ? "★ 已收藏" : "☆ 收藏";
    // 详情内的星/相关 chip/节点 → 联动(点 chip 跳详情,点节点跳详情,点星切收藏)
    detailBody.querySelectorAll(".card-star").forEach(function (s) {
      s.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleFav(id);
        var now = !!state.favs[id];
        s.classList.toggle("on", now);
        s.textContent = now ? "★" : "☆";
        detailFavBtn.classList.toggle("on", now);
        detailFavBtn.textContent = now ? "★ 已收藏" : "☆ 收藏";
      });
    });
    detailBody.querySelectorAll(".rel-chip").forEach(function (c) {
      c.addEventListener("click", function (e) {
        e.stopPropagation();
        openDetail(c.getAttribute("data-go"));
      });
    });
    detailBody.querySelectorAll(".node-g").forEach(function (g) {
      g.addEventListener("click", function () {
        var label = g.getAttribute("data-node");
        var explicit = card.nodeLinks && card.nodeLinks[label];
        if (explicit && byId[explicit]) { openDetail(explicit); return; }
        var ids = nodeIndex[label] || [];
        var target = ids.filter(function (x) { return x !== id; })[0] || ids[0];
        if (target) openDetail(target);
      });
    });
    detailModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";  // 防止背景滚动
    detailModal.scrollTop = 0;   // 重置滚动位置
  }

  function closeDetail() {
    detailModal.classList.add("hidden");
    currentDetailId = null;
    document.body.style.overflow = "";
    // 回到瀑布流时,可能收藏状态变了,刷新一下
    if (!feedView.classList.contains("hidden")) {
      renderFeedFilter();
      renderFeed();
    }
  }

  /* ---------- 键盘兜底 ---------- */
  document.addEventListener("keydown", function (e) {
    // 详情 modal 打开时,ESC 关闭,优先级最高
    if (e.key === "Escape" && !detailModal.classList.contains("hidden")) {
      closeDetail();
      return;
    }
    if (!detailModal.classList.contains("hidden")) return;   // 详情打开时不响应牌堆快捷键
    if (myView.classList.contains("hidden") === false) return; // 在我的知识页不响应
    if (e.key === "ArrowLeft") { act("seen", "left"); }       // 左 = 下一张
    else if (e.key === "ArrowRight") { undo(); }               // 右 = 上一张
    else if (e.key === "ArrowDown") { act("fav", "down"); }    // 下 = 收藏
    else if (e.key === "ArrowUp") { act("seen", "up"); }       // 上 = 下一张
    else if (e.key === "z" || e.key === "Z") { undo(); }       // z = 撤销/上一张
  });

  /* ---------- 我的知识 ---------- */
  function renderMy() {
    var favIds = Object.keys(state.favs);
    var html = '<button class="ln-btn back-btn" id="backBtn">← 返回刷</button>' +
      '<div class="my-head">我的知识</div>' +
      '<p class="my-sub">收藏的卡片会留在这里。点卡片回到那张卡，点右上角 × 移除。</p>';
    var ints = Object.keys(state.interest).filter(function (k) { return state.interest[k] > 0; })
      .sort(function (a, b) { return state.interest[b] - state.interest[a]; }).slice(0, 10);
    if (ints.length) {
      html += '<div class="interest-row">' + ints.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div>';
    }
    if (!favIds.length) {
      html += '<div class="my-empty">还没有收藏。<br>刷的时候下划（或点右上角 ☆ / 底部「收藏」）就能存下来。</div>';
    } else {
      html += '<div class="my-list">' + favIds.map(function (id) {
        var c = byId[id]; if (!c) return "";
        return '<div class="my-item" data-go="' + id + '">' +
          '<div class="my-item-body"><div class="t">' + esc(c.hook) + '</div>' +
          '<div class="meta">' + (c.tags || []).map(esc).join(" · ") + '</div></div>' +
          '<button class="my-remove" data-rm="' + id + '" title="移除收藏" aria-label="移除收藏">×</button></div>';
      }).join("") + '</div>';
    }
    var st = myView.querySelector(".ln-stage");
    if (st) st.innerHTML = html; else myView.innerHTML = html;
    document.getElementById("backBtn").addEventListener("click", showSwipe);
    myView.querySelectorAll(".my-item").forEach(function (it) {
      it.addEventListener("click", function () { showSwipe(); goTo(it.getAttribute("data-go")); });
    });
    myView.querySelectorAll(".my-remove").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        removeFav(b.getAttribute("data-rm"));
      });
    });
  }

  function removeFav(id) {
    var c = byId[id];
    if (!c || !state.favs[id]) return;
    delete state.favs[id];
    bumpInterest(c.tags, -3);
    save();
    renderMy();
    updateCount();
  }

  function showSwipe() {
    swipeView.classList.remove("hidden");
    feedView.classList.add("hidden");
    myView.classList.add("hidden");
    document.getElementById("foot").classList.remove("hidden");
  }
  function showFeed() {
    renderFeedFilter();
    renderFeed();
    swipeView.classList.add("hidden");
    feedView.classList.remove("hidden");
    myView.classList.add("hidden");
    document.getElementById("foot").classList.add("hidden");
  }
  function showMy() {
    renderMy();
    swipeView.classList.add("hidden");
    feedView.classList.add("hidden");
    myView.classList.remove("hidden");
    document.getElementById("foot").classList.add("hidden");
  }

  document.getElementById("btnSwipe").addEventListener("click", function () { showSwipe(); syncNav(); });
  document.getElementById("btnFeed").addEventListener("click", function () { showFeed(); syncNav(); });
  document.getElementById("btnMy").addEventListener("click", function () { showMy(); syncNav(); });
  function syncNav() {
    var onSwipe = !swipeView.classList.contains("hidden");
    var onFeed = !feedView.classList.contains("hidden");
    document.getElementById("btnSwipe").classList.toggle("on", onSwipe);
    document.getElementById("btnFeed").classList.toggle("on", onFeed);
    document.getElementById("btnMy").classList.toggle("on", !onSwipe && !onFeed);
  }

  // 详情 modal 事件绑定
  document.getElementById("detailClose").addEventListener("click", closeDetail);
  document.getElementById("detailOverlay").addEventListener("click", closeDetail);
  document.getElementById("detailFav").addEventListener("click", function () {
    if (!currentDetailId) return;
    var id = currentDetailId;
    toggleFav(id);
    var now = !!state.favs[id];
    this.classList.toggle("on", now);
    this.textContent = now ? "★ 已收藏" : "☆ 收藏";
    // 详情内顶部星同步
    var topStar = detailBody.querySelector(".card-star");
    if (topStar) {
      topStar.classList.toggle("on", now);
      topStar.textContent = now ? "★" : "☆";
    }
  });
  document.getElementById("detailGoSwipe").addEventListener("click", function () {
    if (!currentDetailId) return;
    var id = currentDetailId;
    closeDetail();
    showSwipe(); syncNav();
    goTo(id);   // 切到牌堆视图,把这张卡放到顶层接着刷
  });

  // 底部按钮（上一张=右滑 / 收藏=下划 / 下一张=左滑）
  document.getElementById("actPrev").addEventListener("click", undo);
  document.getElementById("actSeen").addEventListener("click", function () { act("seen", "left"); });
  document.getElementById("actFav").addEventListener("click", function () { act("fav", "down"); });
  // 回到 Exam Hub（极小首页按钮）
  document.getElementById("homeMini").addEventListener("click", function () { location.href = "../index.html"; });

  /* ---------- 启动 ---------- */
  syncNav();
  fillQueue();
  renderStack("instant");
})();
