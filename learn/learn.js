/* LEARN 1.0 · 核心逻辑
 * - 单卡全屏 + SVG 知识树
 * - 上滑=看过 / 下滑=收藏 / 左滑=跳过 / 点节点或相关=深入
 * - 推荐：70% 兴趣 + 20% 邻近 + 10% 随机探索
 * - 行为存 localStorage（零云、零成本；后续可平滑迁 IndexedDB）
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
    return { seen: {}, favs: {}, skip: {}, interest: {}, last: null, path: [] };
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

  function pickNext(currentId) {
    var pool = DATA.filter(function (c) { return !state.seen[c.id]; });
    var currentTags = currentId ? (byId[currentId] && byId[currentId].tags) : null;
    if (pool.length === 0) {
      // 全刷完：重置 seen，循环再来（保留 favs/interest）
      state.seen = {}; save();
      pool = DATA.slice();
    }
    // 70% 兴趣/邻近主导，30% 完全随机（含 10% 探索）
    var explore = Math.random() < 0.3;
    if (explore) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    var best = null, bestS = -1e9;
    pool.forEach(function (c) {
      var s = scoreCard(c, currentTags) + Math.random() * 0.5; // 轻微打散
      if (s > bestS) { bestS = s; best = c; }
    });
    return best || pool[0];
  }

  /* ---------- 渲染 ---------- */
  var deck = document.getElementById("deck");
  var countEl = document.getElementById("count");
  var favBtn = null;
  var current = null;

  function relatedChips(card) {
    var ids = card.related || [];
    if (!ids.length) return "";
    var chips = ids.filter(function (id) { return byId[id]; })
      .map(function (id) { return '<span class="rel-chip" data-go="' + id + '">' + esc(byId[id].hook.replace(/？$/, "")) + '</span>'; })
      .join("");
    return chips ? '<div class="card-related"><span class="rlabel">相关</span>' + chips + '</div>' : "";
  }

  function renderCard(card, animate) {
    current = card;
    state.last = card.id; save();
    var faved = !!state.favs[card.id];
    var srcBadge = card.source ? '<span class="badge ' + (card.source.type === "official" ? "official" : "") + '">' +
      (card.source.type === "official" ? "官方" : "资料") + '</span>' : "";
    deck.innerHTML =
      '<div class="card ' + (animate ? "enter" : "settle") + '" id="cardEl">' +
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
    // 底部收藏按钮状态（保留手势提示文字，仅用颜色区分）
    favBtn = document.querySelector(".act.fav");
    if (favBtn) { favBtn.classList.toggle("on", faved); }
    bindCard();
    updateCount();
  }

  function updateCount() {
    var total = DATA.length, seen = Object.keys(state.seen).length, fav = Object.keys(state.favs).length;
    countEl.textContent = "已看 " + seen + " / " + total + " · 收藏 " + fav;
  }

  /* ---------- 动作 ---------- */
  function act(type, dir) {
    if (!current) return;
    var id = current.id;
    if (type === "seen") { state.seen[id] = 1; bumpInterest(current.tags, 1); }
    else if (type === "fav") {
      if (state.favs[id]) { delete state.favs[id]; bumpInterest(current.tags, -3); }
      else { state.favs[id] = 1; state.seen[id] = 1; bumpInterest(current.tags, 3); }
    }
    else if (type === "skip") { state.seen[id] = 1; bumpInterest(current.tags, -1); }
    save();

    var cardEl = document.getElementById("cardEl");
    if (cardEl && dir) {
      cardEl.classList.remove("enter", "settle");
      cardEl.classList.add("out-" + dir);
    }
    var next = pickNext(id);
    setTimeout(function () { renderCard(next, true); }, dir ? 300 : 0);
  }

  function goTo(id) {
    if (!byId[id]) return;
    state.seen[id] = 1; save();
    renderCard(byId[id], true);
  }

  /* ---------- 滑动手势 ---------- */
  function bindCard() {
    var el = document.getElementById("cardEl");
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
      if (dy < -60) act("seen", "up");
      else if (dy > 60) act("fav", "down");
      else if (dx < -60) act("skip", "left");
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", function (e) { if (dragging && !e.relatedTarget) end(); });

    // 点节点深入
    el.querySelectorAll(".node-g").forEach(function (g) {
      g.addEventListener("click", function () {
        var label = g.getAttribute("data-node");
        var ids = nodeIndex[label] || [];
        // 优先跳到“不是当前卡”的关联卡
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
    if (e.key === "ArrowUp") { act("seen", "up"); }
    else if (e.key === "ArrowDown") { act("fav", "down"); }
    else if (e.key === "ArrowLeft") { act("skip", "left"); }
  });

  /* ---------- 我的知识 ---------- */
  var myView = document.getElementById("myView");
  var swipeView = document.getElementById("swipeView");
  function renderMy() {
    var favIds = Object.keys(state.favs);
    var html = '<button class="ln-btn back-btn" id="backBtn">← 返回刷</button>' +
      '<div class="my-head">我的知识</div>' +
      '<p class="my-sub">收藏的卡片会留在这里。点任意一条回到那张卡。</p>';
    // 兴趣画像
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

  // 底部按钮
  document.getElementById("actSkip").addEventListener("click", function () { act("skip", "left"); });
  document.getElementById("actSeen").addEventListener("click", function () { act("seen", "up"); });
  document.getElementById("actFav").addEventListener("click", function () { act("fav", "down"); });

  /* ---------- 启动 ---------- */
  syncNav();
  renderCard(pickNext(null), true);
})();
