/* RCJ Exam Hub — 通用真题题目列表 / 真题库渲染器
 * 用法：在页面中先定义
 *   window.RCJ_META = { title: '国考', subtitle: '国家公务员考试' };
 *   window.RCJ_QUESTIONS = [ { year: 2024, type: '行测', stem: '题干…' }, ... ];  // 可选，真实题目数据
 *   window.RCJ_PDFS = [ { year, cat, title, file }, ... ];                        // 可选，真题原卷
 * 再引入本脚本：有题目则渲染题目索引；有 PDF 则渲染「历年真题库」（在线查看 + 下载）。
 * 搜索框同时过滤题目与真题。
 */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var meta = window.RCJ_META || { title: 'RCJ Exam Hub', subtitle: '' };
  var questions = window.RCJ_QUESTIONS || [];
  // 真题清单 = RCJ_PDFS（Cloudflare 托管的 PDF） + RCJ_PAN（网盘托管，按 title 合并）
  // 双轨：同一题可同时有 file（站内在线查看）与 pan（夸克网盘领取）；也可仅有 pan（纯网盘资源）。
  var pdfs = (window.RCJ_PDFS || []).slice();
  (function () {
    var panList = window.RCJ_PAN || [];
    if (!panList.length) return;
    var byTitle = {};
    pdfs.forEach(function (p, i) { if (p && p.title) byTitle[p.title] = i; });
    panList.forEach(function (e) {
      if (!e || !e.title) return;
      if (Object.prototype.hasOwnProperty.call(byTitle, e.title)) {
        var p = pdfs[byTitle[e.title]];
        if (e.pan) p.pan = e.pan;
        if (e.code) p.code = e.code;
        if (!p.cat && e.cat) p.cat = e.cat;
        if (!p.year && e.year) p.year = e.year;
      } else {
        // 仅有网盘链接的题（本地无 PDF）：作为独立真题条目加入
        pdfs.push({ year: e.year || '', cat: e.cat || '网盘资源', title: e.title, pan: e.pan, code: e.code });
      }
    });
  })();
  var lazyObserver = null;
  var app = document.getElementById('rcj-app');
  if (!app) return;

  var indexed = questions.map(function (x, i) { return { q: x, no: i + 1 }; });

  // —— 页面骨架 ——
  app.innerHTML =
    '<header class="topbar"><div class="nav">' +
      '<a class="brand" href="/">RCJ <span>Exam Hub</span></a>' +
      '<a class="gh" href="https://github.com/ZHOUQIANG5827/rcj-exam-bank" target="_blank" rel="noopener">GitHub</a>' +
    '</div></header>' +
    '<main>' +
      '<a class="backlink" href="/">← 返回考试学习中心</a>' +
      '<h1>' + escapeHtml(meta.title) + '</h1>' +
      (meta.subtitle ? '<p class="sub">' + escapeHtml(meta.subtitle) + '</p>' : '') +
      '<div class="toolbar">' +
        '<input id="rcj-search" type="search" placeholder="搜索年份 / 科目 / 关键词…" aria-label="搜索真题" />' +
        '<span id="rcj-count" class="count"></span>' +
      '</div>' +
      (questions.length ? '<div id="rcj-list" class="list"></div>' : '') +
      (pdfs.length ? '<section class="pdf-section" id="rcj-pdfs"></section>' : '') +
      '<p class="note">本站为公开考试资料的学习工具：真题原卷免费在线查看 / 下载；答案、解析、Anki、AI 讲解、AI 刷题、错题收藏等完整体验请关注公众号与闲鱼 RCJ9527。</p>' +
    '</main>';

  var searchEl = document.getElementById('rcj-search');
  var countEl = document.getElementById('rcj-count');
  var listEl = document.getElementById('rcj-list');
  var pdfWrap = document.getElementById('rcj-pdfs');

  // —— 题目列表（仅有真实题目数据时渲染）——
  function renderQuestions(filter) {
    if (!listEl) return;
    var f = (filter || '').trim().toLowerCase();
    var matched = f
      ? indexed.filter(function (it) {
          var hay = (it.q.stem || '') + ' ' + (it.q.type || '') + ' ' + (it.q.year || '');
          return hay.toLowerCase().indexOf(f) !== -1;
        })
      : indexed;
    var html = matched.map(function (it) {
      var x = it.q;
      var tags = '';
      if (x.year) tags += '<span class="tag tag-year">' + escapeHtml(x.year) + '</span>';
      if (x.type) tags += '<span class="tag tag-type">' + escapeHtml(x.type) + '</span>';
      return (
        '<article class="q">' +
          '<div class="q-top">' + tags +
            '<span class="q-no">#' + ('000' + it.no).slice(-3) + '</span>' +
          '</div>' +
          '<p class="q-stem">' + escapeHtml(x.stem) + '</p>' +
          '<div class="q-foot">答案与解析整理中</div>' +
        '</article>'
      );
    }).join('');
    listEl.innerHTML = html || '<p class="empty">暂无匹配题目</p>';
  }

  // —— 历年真题库（在线查看 + 下载 + 网盘领取）——
  function renderPdfs(filter) {
    if (!pdfWrap) return 0;
    if (lazyObserver) { lazyObserver.disconnect(); lazyObserver = null; }
    var f = (filter || '').trim().toLowerCase();
    var matched = f
      ? pdfs.filter(function (p) {
          var hay = (p.title || '') + ' ' + (p.cat || '') + ' ' + (p.year || '');
          return hay.toLowerCase().indexOf(f) !== -1;
        })
      : pdfs.slice();

    if (!matched.length) {
      pdfWrap.innerHTML = '<h2 class="pdf-h">历年真题库</h2><p class="empty">没有匹配的真题，换个关键词试试。</p>';
      return 0;
    }

    var groups = {};
    matched.forEach(function (p) { (groups[p.cat] = groups[p.cat] || []).push(p); });
    // 科目排序：默认含常见公职考试科目；可用 RCJ_META.subjectOrder 自定义顺序
    var order = { '行测': 0, '申论': 1, '公共科目': 0, '专业科目': 1, '公基': 2, '职测': 2, '教综': 2, '学科': 3, '网盘资源': 4 };
    if (meta.subjectOrder && Array.isArray(meta.subjectOrder)) {
      meta.subjectOrder.forEach(function (c, i) { order[c] = i; });
    }
    var cats = Object.keys(groups).sort(function (a, b) { return (order[a] != null ? order[a] : 9) - (order[b] != null ? order[b] : 9); });

    pdfWrap.innerHTML =
      '<h2 class="pdf-h">历年真题库 · 在线查看 / 下载</h2>' +
      '<p class="pdf-sub">已收录 ' + pdfs.length + ' 套' + escapeHtml(meta.title) + '真题原卷（含参考答案 / 解析）。点击「在线查看」即可在浏览器内阅读并一键下载；标注「网盘领取」的来自夸克网盘。</p>' +
      '<div id="rcj-pdf-body"></div>' +
      '<div id="rcj-pdf-sentinel" class="pdf-sentinel" aria-hidden="true"></div>';

    var body = document.getElementById('rcj-pdf-body');
    var sentinel = document.getElementById('rcj-pdf-sentinel');
    var catIndex = 0;

    function cardHtml(p) {
      var actions = '';
      if (p.file) {
        var url = encodeURI(p.file);
        actions += '<a class="pdf-view" href="' + url + '" target="_blank" rel="noopener">在线查看</a>';
        actions += '<a class="pdf-dl" href="' + url + '" download>下载 PDF</a>';
      }
      if (p.pan) {
        actions += '<a class="pdf-pan" href="' + escapeHtml(p.pan) + '" target="_blank" rel="noopener">网盘领取</a>';
        if (p.code) actions += '<span class="pdf-code">提取码：' + escapeHtml(p.code) + '</span>';
      }
      if (!actions) actions = '<span class="pdf-soon">资源整理中</span>';
      return '<div class="pdf-card">' +
        '<span class="pdf-year">' + escapeHtml(p.year) + '</span>' +
        '<span class="pdf-title">' + escapeHtml(p.title) + '</span>' +
        '<span class="pdf-actions">' + actions + '</span>' +
      '</div>';
    }

    // 一次渲染一个科目分组，避免跨块时 grid 标签未闭合
    function renderOne() {
      if (catIndex >= cats.length) {
        sentinel.style.display = 'none';
        if (lazyObserver) { lazyObserver.disconnect(); lazyObserver = null; }
        return;
      }
      var cat = cats[catIndex++];
      var frag = '<h3 class="pdf-cat">' + escapeHtml(cat) + '</h3><div class="pdf-grid">';
      groups[cat].forEach(function (p) { frag += cardHtml(p); });
      frag += '</div>';
      body.insertAdjacentHTML('beforeend', frag);
      if (catIndex < cats.length) {
        var r = sentinel.getBoundingClientRect();
        // 首屏内容不足一屏时继续渲染，直到哨兵被推到视口下方；否则交给滚动监听
        if (r.top < (window.innerHeight || 9999)) renderOne();
        else if (lazyObserver) lazyObserver.observe(sentinel);
      } else {
        sentinel.style.display = 'none';
      }
    }

    // 搜索态或浏览器不支持 IntersectionObserver：一次性全部渲染
    if (f || !('IntersectionObserver' in window)) {
      while (catIndex < cats.length) renderOne();
    } else {
      lazyObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) renderOne(); });
      });
      lazyObserver.observe(sentinel);
      renderOne(); // 首屏填满（内部递归渲染至哨兵离开视口）
    }
    return matched.length;
  }

  function renderAll(v) {
    renderQuestions(v);
    var n = renderPdfs(v);
    if (countEl) {
      var bits = [];
      if (listEl) bits.push(indexed.length + ' 题');
      if (pdfWrap) bits.push(n + ' 套真题');
      countEl.textContent = bits.join(' · ');
    }
  }

  if (searchEl) searchEl.addEventListener('input', function () { renderAll(searchEl.value); });
  renderAll('');
})();
