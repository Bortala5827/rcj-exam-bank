/* RCJ Exam Hub — 通用真题题目列表渲染器
 * 用法：在页面中先定义
 *   window.RCJ_META = { title: '国考', subtitle: '国家公务员考试' };
 *   window.RCJ_QUESTIONS = [ { year: 2024, type: '行测', stem: '题干…' }, ... ];
 * 再引入本脚本，它会渲染题目列表（仅题干，答案/解析占位）。
 */
(function () {
  'use strict';

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var meta = window.RCJ_META || { title: 'RCJ Exam Hub', subtitle: '' };
  var questions = window.RCJ_QUESTIONS || [];

  var app = document.getElementById('rcj-app');
  if (!app) return;

  // 预存原始序号，过滤后题目编号保持稳定
  var indexed = questions.map(function (x, i) { return { q: x, no: i + 1 }; });

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
        '<input id="rcj-search" type="search" placeholder="搜索题目关键词…" aria-label="搜索题目关键词" />' +
        '<span id="rcj-count" class="count"></span>' +
      '</div>' +
      '<div id="rcj-list" class="list"></div>' +
      '<p class="note">本站前期仅收录真题题目作为资料索引，答案与解析将逐步补全。完整刷题体验（答案、解析、Anki、AI 讲解、错题收藏）请关注后续更新。</p>' +
    '</main>';

  var listEl = document.getElementById('rcj-list');
  var countEl = document.getElementById('rcj-count');
  var searchEl = document.getElementById('rcj-search');

  function render(filter) {
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
    countEl.textContent = matched.length + ' 题';
  }

  searchEl.addEventListener('input', function () { render(searchEl.value); });
  render('');
})();
