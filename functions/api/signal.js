/* 面试对练舱 · D1 集中撮合大厅（替代 PeerJS 大厅自撮合）
 * POST /api/signal?action=join  -> body { city, peerId } 加入等待池或立即配对
 * GET  /api/signal?action=poll&city=sz&ticket=xxx  -> 查询是否已配对
 * POST /api/signal?action=cancel&city=sz&ticket=xxx  -> 取消等待
 *
 * 配对成功后返回 { matched:true, room, isHost, role, peerId }
 *   room:   练习房 PeerJS ID（房主用此 ID 创建房间）
 *   isHost: 当前用户是否为房主
 *   role:   当前用户角色 examiner/candidate
 *   peerId: 对方 PeerJS ID（调试/备用）
 *
 * 依赖 env.DB（D1）；未绑定返回 503 DB_NOT_BOUND。
 */
const CITIES = ["sz", "hz", "gd", "ms", "cd", "wh"];
const WAIT_TTL = 300;          // 等待池条目 TTL（秒，仅用于惰性清理）
const MATCH_TTL = 300;         // 配对结果 TTL（秒）
const MAX_WAIT = 60;           // 单个城市等待池最多保留条目（防异常堆积）

function sanitize(s, max) {
  s = (s || "").toString().trim();
  if (s.length > max) s = s.slice(0, max);
  return s;
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
function cityOf(raw) {
  var c = sanitize(raw, 10).toLowerCase();
  return CITIES.indexOf(c) >= 0 ? c : "sz";
}
function ticket() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function genRoom() {
  return "r" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}
function getDB(env) {
  if (env && env.DB) return env.DB;
  if (env) {
    for (const k of Object.keys(env)) {
      const v = env[k];
      if (v && typeof v.prepare === "function" && typeof v.exec === "function") return v;
    }
  }
  return null;
}

async function joinOrWait(db, city, myPeerId) {
  const myTicket = ticket();
  const now = Date.now();
  // 惰性清理过期等待条目
  try { await db.prepare("DELETE FROM signal_wait WHERE created_at < ?").bind(now - 240000).run(); } catch (e) {}
  for (let attempt = 0; attempt < 5; attempt++) {
    const { results } = await db.prepare(
      "SELECT ticket,peer_id,created_at FROM signal_wait WHERE city=? ORDER BY created_at ASC"
    ).bind(city).all();
    const list = (results || []).filter(function (x) {
      return x.peer_id !== myPeerId && (x.created_at || 0) > now - 240000;
    });
    if (list.length > 0) {
      const partner = list[0];
      // 抢占对方等待条目，避免并发双匹配
      const del = await db.prepare("DELETE FROM signal_wait WHERE ticket=? AND peer_id=?")
        .bind(partner.ticket, partner.peer_id).run();
      if (!del.meta || !del.meta.changes) { await new Promise(function (r) { setTimeout(r, 50); }); continue; }
      const room = genRoom();
      const partnerRole = Math.random() < 0.5 ? "examiner" : "candidate";
      const myRole = partnerRole === "examiner" ? "candidate" : "examiner";
      const exp = now + MATCH_TTL * 1000;
      try {
        await db.prepare("INSERT OR REPLACE INTO signal_match (ticket,room,is_host,role,peer_id,expires) VALUES (?,?,1,?,?,?)")
          .bind(partner.ticket, room, partnerRole, myPeerId, exp).run();
        await db.prepare("INSERT OR REPLACE INTO signal_match (ticket,room,is_host,role,peer_id,expires) VALUES (?,?,0,?,?,?)")
          .bind(myTicket, room, myRole, partner.peer_id, exp).run();
        return { ok: true, matched: true, ticket: myTicket, room: room, isHost: false, role: myRole, peerId: partner.peer_id };
      } catch (e) {
        await new Promise(function (r) { setTimeout(r, 50); });
        continue;
      }
    } else {
      try {
        await db.prepare("INSERT OR REPLACE INTO signal_wait (ticket,city,peer_id,created_at) VALUES (?,?,?,?)")
          .bind(myTicket, city, myPeerId, now).run();
        return { ok: true, matched: false, ticket: myTicket };
      } catch (e) {
        await new Promise(function (r) { setTimeout(r, 50); });
        continue;
      }
    }
  }
  return { ok: false, error: "BUSY" };
}

async function cancelWait(db, t) {
  try { await db.prepare("DELETE FROM signal_wait WHERE ticket=?").bind(t).run(); } catch (e) {}
  return { ok: true };
}

async function pollMatch(db, t) {
  try {
    const { results } = await db.prepare("SELECT * FROM signal_match WHERE ticket=?").bind(t).all();
    if (results && results.length) {
      const m = results[0];
      // 过期则清理
      if (m.expires && m.expires < Date.now()) {
        await db.prepare("DELETE FROM signal_match WHERE ticket=?").bind(t).run();
        return { ok: true, matched: false };
      }
      return { ok: true, matched: true, room: m.room, isHost: !!m.is_host, role: m.role, peerId: m.peer_id };
    }
  } catch (e) {}
  return { ok: true, matched: false };
}

export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const action = url.searchParams.get("action") || "join";
  const db = getDB(context.env);
  if (!db) return json({ ok: false, error: "DB_NOT_BOUND" }, 503);

  if (action === "cancel") {
    const city = cityOf(url.searchParams.get("city"));
    const t = sanitize(url.searchParams.get("ticket"), 40);
    if (!t) return json({ ok: false, error: "MISSING_TICKET" }, 400);
    return json(await cancelWait(db, t));
  }

  if (action !== "join") return json({ ok: false, error: "BAD_ACTION" }, 400);

  let body;
  try { body = await context.request.json(); } catch (e) { body = {}; }
  const city = cityOf(body.city);
  const peerId = sanitize(body.peerId, 60);
  if (!peerId) return json({ ok: false, error: "MISSING_PEER_ID" }, 400);

  return json(await joinOrWait(db, city, peerId));
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const action = url.searchParams.get("action") || "poll";
  const db = getDB(context.env);
  if (!db) return json({ ok: false, error: "DB_NOT_BOUND" }, 503);

  if (action === "poll") {
    const t = sanitize(url.searchParams.get("ticket"), 40);
    const city = cityOf(url.searchParams.get("city"));
    if (!t) return json({ ok: false, error: "MISSING_TICKET" }, 400);
    return json(await pollMatch(db, t));
  }

  return json({ ok: false, error: "BAD_ACTION" }, 400);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
