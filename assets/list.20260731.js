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
  var pdfs = window.RCJ_PDFS || [];
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

  // —— 历年真题库（在线查看 + 下载）——
  function renderPdfs(filter) {
    if (!pdfWrap) return 0;
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
    var order = { '行测': 0, '申论': 1, '公共科目': 0, '专业科目': 1, '公基': 2, '职测': 2, '教综': 2, '学科': 3 };
    if (meta.subjectOrder && Array.isArray(meta.subjectOrder)) {
      meta.subjectOrder.forEach(function (c, i) { order[c] = i; });
    }
    var cats = Object.keys(groups).sort(function (a, b) { return (order[a] != null ? order[a] : 9) - (order[b] != null ? order[b] : 9); });

    var sec = '<h2 class="pdf-h">历年真题库 · 在线查看 / 下载</h2>' +
      '<p class="pdf-sub">已收录 ' + pdfs.length + ' 套' + escapeHtml(meta.title) + '真题原卷（含参考答案 / 解析）。点击「在线查看」即可在浏览器内阅读，也可一键下载到本地。</p>';
    cats.forEach(function (cat) {
      sec += '<h3 class="pdf-cat">' + escapeHtml(cat) + '</h3><div class="pdf-grid">';
      groups[cat].forEach(function (p) {
        var url = encodeURI(p.file);
        sec += '<div class="pdf-card">' +
          '<span class="pdf-year">' + escapeHtml(p.year) + '</span>' +
          '<span class="pdf-title">' + escapeHtml(p.title) + '</span>' +
          '<span class="pdf-actions">' +
            '<a class="pdf-view" href="' + url + '" target="_blank" rel="noopener">在线查看</a>' +
            '<a class="pdf-dl" href="' + url + '" download>下载 PDF</a>' +
          '</span>' +
        '</div>';
      });
      sec += '</div>';
    });
    pdfWrap.innerHTML = sec;
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
