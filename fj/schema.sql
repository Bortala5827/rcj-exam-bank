-- 辅警刷题站 · D1 schema（留言墙 / 对练舱信令 / 撮合大厅 / 访问限流）
-- 在 Cloudflare 后台 D1 控制台（该库 → Console）粘贴执行一次。
-- 绑定名用 DB（代码也能自动识别任意 D1 绑定）。

-- ===== 陪练留言墙 / 约练 =====
CREATE TABLE IF NOT EXISTS wall (
  id           TEXT PRIMARY KEY,
  city         TEXT NOT NULL,
  name         TEXT,
  type         TEXT,
  text         TEXT,
  meet_at      TEXT,
  meet_at_iso  TEXT,
  direction    TEXT,
  contact      TEXT,
  resp         INTEGER DEFAULT 0,
  resp_users   TEXT    DEFAULT '[]',
  created_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_wall_city_created ON wall(city, created_at DESC);

CREATE TABLE IF NOT EXISTS wall_rl (
  ip      TEXT PRIMARY KEY,
  last_ts INTEGER
);
CREATE TABLE IF NOT EXISTS wall_day (
  ip  TEXT NOT NULL,
  day TEXT NOT NULL,
  n   INTEGER DEFAULT 0,
  PRIMARY KEY (ip, day)
);

-- ===== 面试对练舱 · WebRTC 信令通道 =====
CREATE TABLE IF NOT EXISTS rtc_signals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room       TEXT NOT NULL,
  from_tag   TEXT,
  type       TEXT,
  payload    TEXT,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rtc_room ON rtc_signals(room, id);

-- ===== 面试对练舱 · 撮合大厅 =====
CREATE TABLE IF NOT EXISTS signal_wait (
  ticket    TEXT PRIMARY KEY,
  city      TEXT,
  peer_id   TEXT,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_wait_city ON signal_wait(city, created_at);

CREATE TABLE IF NOT EXISTS signal_match (
  ticket   TEXT PRIMARY KEY,
  room     TEXT,
  is_host  INTEGER,
  role     TEXT,
  peer_id  TEXT,
  expires  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_match_exp ON signal_match(expires);

-- ===== 每日访问限流（防白嫖） =====
CREATE TABLE IF NOT EXISTS visit_counts (
  ip  TEXT NOT NULL,
  day TEXT NOT NULL,
  n   INTEGER DEFAULT 0,
  PRIMARY KEY (ip, day)
);
