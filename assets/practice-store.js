// practice-store.js — 可复用本地存储（练习日志 + 自定义题库）
// 纯前端 / IndexedDB / 无第三方依赖。可被任意 Speak Series 产品 drop-in 复用：
//   1) 在页面引入 <script src="/assets/practice-store.js"></script>
//   2) 用 window.RCJPracticeStore 调用下方方法
// 数据全部在用户本机浏览器，不联网、不上传；清缓存 / 换设备即丢失，需配合导出。
(function (global) {
  'use strict';

  var DB_NAME = 'rcj_practice';
  var DB_VER = 1;
  var STORE_SESSIONS = 'sessions';   // 练习日志：{id,createdAt,cat,catLabel,q,durMs,audioBlob,rating,note}
  var STORE_TOPICS = 'customTopics'; // 用户自定义题库：{id,createdAt,q}

  var _db = null;
  function open() {
    if (_db) return _db;
    _db = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_SESSIONS))
          db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_TOPICS))
          db.createObjectStore(STORE_TOPICS, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return _db;
  }

  function uid() {
    return (global.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function tx(store, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var os = t.objectStore(store);
        var result;
        var req = fn(os);
        if (req) req.onsuccess = function () { result = req.result; };
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }

  // ── 练习日志 ──
  function addSession(s) {
    var row = Object.assign({ id: uid(), createdAt: Date.now(), rating: 0, note: '' }, s);
    return tx(STORE_SESSIONS, 'readwrite', function (os) { return os.put(row); }).then(function () { return row; });
  }
  function getAllSessions() {
    return tx(STORE_SESSIONS, 'readonly', function (os) { return os.getAll(); })
      .then(function (rows) { return (rows || []).sort(function (a, b) { return b.createdAt - a.createdAt; }); });
  }
  function getSession(id) {
    return tx(STORE_SESSIONS, 'readonly', function (os) { return os.get(id); });
  }
  function deleteSession(id) {
    return tx(STORE_SESSIONS, 'readwrite', function (os) { return os.delete(id); });
  }
  function updateSession(id, patch) {
    return getSession(id).then(function (row) {
      if (!row) return null;
      var merged = Object.assign({}, row, patch);
      return tx(STORE_SESSIONS, 'readwrite', function (os) { return os.put(merged); }).then(function () { return merged; });
    });
  }

  // ── 自定义题库 ──
  // opts.skipDup=true 时跳过与已有题目完全重复（去首尾空白 + 忽略大小写）的项，避免重复导入翻倍
  function addCustomTopics(list, opts) {
    opts = opts || {};
    var skipDup = !!opts.skipDup;
    return getCustomTopics().then(function (existing) {
      var have = {};
      existing.forEach(function (t) { have[String(t.q == null ? '' : t.q).trim().toLowerCase()] = true; });
      var now = Date.now();
      var rows = [];
      (list || []).forEach(function (q, i) {
        q = String(q == null ? '' : q).replace(/^﻿/, '').trim(); // 去 BOM + 首尾空白
        if (!q) return;
        if (skipDup && have[String(q).toLowerCase()]) return; // 与已有完全重复则跳过
        rows.push({ id: uid(), q: q, createdAt: now + i }); // 批内 createdAt 递增，保留粘贴/导入顺序
      });
      if (!rows.length) return 0;
      return Promise.all(rows.map(function (r) {
        return tx(STORE_TOPICS, 'readwrite', function (os) { return os.put(r); });
      })).then(function () { return rows.length; });
    });
  }
  function getCustomTopics() {
    return tx(STORE_TOPICS, 'readonly', function (os) { return os.getAll(); })
      .then(function (r) {
        r = r || [];
        // 按 createdAt 升序，保证列表与抽题顺序 = 用户添加顺序（修复：此前按 UUID key 乱序）
        r.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
        return r;
      });
  }
  function deleteCustomTopic(id) {
    if (id == null) return Promise.resolve(false);
    return tx(STORE_TOPICS, 'readwrite', function (os) { return os.delete(id); }).then(function () { return true; });
  }
  function clearCustomTopics() {
    return open().then(function (db) {
      return new Promise(function (resolve) {
        var t = db.transaction(STORE_TOPICS, 'readwrite');
        t.objectStore(STORE_TOPICS).clear();
        t.oncomplete = function () { resolve(); };
      });
    });
  }

  global.RCJPracticeStore = {
    addSession: addSession,
    getAllSessions: getAllSessions,
    getSession: getSession,
    updateSession: updateSession,
    deleteSession: deleteSession,
    addCustomTopics: addCustomTopics,
    getCustomTopics: getCustomTopics,
    deleteCustomTopic: deleteCustomTopic,
    clearCustomTopics: clearCustomTopics
  };
})(window);
