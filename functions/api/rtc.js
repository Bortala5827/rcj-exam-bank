/* 面试对练舱 · D1 信令通道（替代 PeerJS 云信令 / KV 中转）
 * 原生 WebRTC + Cloudflare D1 做 SDP/ICE 中转：国内可达、免费、不依赖任何云信令服务器。
 *
 * POST /api/rtc  body { room, tag:"A"|"B", type:"offer"|"answer"|"ice", payload }
 *   写入该房间的信号总线（自增 id 即 seq，供对方按 since 拉取增量）
 * GET  /api/rtc?room=&tag=&since=
 *   返回 from!=tag 且 id>since 的信号（增量）
 *
 * 依赖 env.DB（D1）；未绑定返回 503 DB_NOT_BOUND。
 */
function sanitizeRoom(s) {
  return (s || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
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
function safeParse(s, def) {
  try { return JSON.parse(s); } catch (e) { return def; }
}

export async function onRequestPost(context) {
  const db = getDB(context.env);
  if (!db) return json({ ok: false, error: "DB_NOT_BOUND" }, 503);
  const url = new URL(context.request.url);
  let body;
  try { body = await context.request.json(); } catch (e) { body = {}; }
  const room = sanitizeRoom(body.room || url.searchParams.get("room"));
  if (!room) return json({ ok: false, error: "MISSING_ROOM" }, 400);
  const tag = (body.tag === "A" || body.tag === "B") ? body.tag : "A";
  const type = body.type;
  if (!["offer", "answer", "ice"].includes(type)) return json({ ok: false, error: "BAD_TYPE" }, 400);
  if (!body.payload) return json({ ok: false, error: "MISSING_PAYLOAD" }, 400);

  // 惰性清理：删掉该房间 30 分钟前的旧信令（防无限增长）
  const expire = Date.now() - 1800000;
  try { await db.prepare("DELETE FROM rtc_signals WHERE room=? AND created_at<?").bind(room, expire).run(); } catch (e) {}

  try {
    const info = await db.prepare(
      "INSERT INTO rtc_signals (room, from_tag, type, payload, created_at) VALUES (?,?,?,?,?)"
    ).bind(room, tag, type, JSON.stringify(body.payload), Date.now()).run();
    const seq = (info && info.meta && info.meta.last_row_id) || 0;
    return json({ ok: true, seq: seq });
  } catch (e) {
    return json({ ok: false, error: "WRITE_FAIL" }, 500);
  }
}

export async function onRequestGet(context) {
  const db = getDB(context.env);
  if (!db) return json({ ok: false, error: "DB_NOT_BOUND" }, 503);
  const url = new URL(context.request.url);
  const room = sanitizeRoom(url.searchParams.get("room"));
  if (!room) return json({ ok: false, error: "MISSING_ROOM" }, 400);
  const tag = (url.searchParams.get("tag") === "A" || url.searchParams.get("tag") === "B") ? url.searchParams.get("tag") : "A";
  const since = parseInt(url.searchParams.get("since") || "0", 10) || 0;
  try {
    const { results } = await db.prepare(
      "SELECT id,from_tag,type,payload FROM rtc_signals WHERE room=? AND id>? AND from_tag!=? ORDER BY id ASC"
    ).bind(room, since, tag).all();
    const out = (results || []).map(function (r) {
      return { seq: r.id, from: r.from_tag, type: r.type, payload: safeParse(r.payload, r.payload) };
    });
    return json({ ok: true, signals: out, seq: out.length ? out[out.length - 1].seq : since });
  } catch (e) {
    return json({ ok: true, signals: [], seq: since });
  }
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
