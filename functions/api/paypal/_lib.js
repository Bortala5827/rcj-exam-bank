// PayPal + 订单/通知 共享库（rcj-exam-bank Pages Functions）
// 沙盒默认；PAYPAL_MODE=live 切正式。
const ANALYTICS_DB = 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828'; // rcj-analytics-d1
const NOTIFY_TO = '1430115702@qq.com';
const EMAIL_FROM = 'RCJ 商店 <noreply@955827.xyz>';

// 商品定义（与 shop 右侧卡片一致）
export const ITEMS = {
  'hosting':       { name: '代托管',   price: 9.9, sku: 'hosting' },
  'question-bank': { name: '题库定制', price: 39,  sku: 'question-bank' },
  'build':         { name: '纯建站',   price: 69,  sku: 'build' },
};

export function paypalBase(env) {
  return (env.PAYPAL_MODE === 'live') ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

// 货币：默认沙盒用 USD（沙盒账户多为美元户，CNY 不被支持），live 用 CNY（你的 RMB 定价）。
// 如需强制指定，设 PAYPAL_CURRENCY 密钥（如 CNY / USD）。
export function paypalCurrency(env) {
  if (env.PAYPAL_CURRENCY) return env.PAYPAL_CURRENCY;
  return (env.PAYPAL_MODE === 'live') ? 'CNY' : 'USD';
}

// 模块级缓存 access token（单实例足够）
let _token = null, _exp = 0;
export async function getToken(env) {
  const now = Date.now();
  if (_token && now < _exp - 5000) return _token;
  const auth = btoa(env.PAYPAL_CLIENT_ID + ':' + env.PAYPAL_CLIENT_SECRET);
  const r = await fetch(paypalBase(env) + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json();
  if (!r.ok) throw new Error('PayPal token 失败: ' + (j.error_description || r.status));
  _token = j.access_token;
  _exp = now + (j.expires_in || 3600) * 1000;
  return _token;
}

export async function pp(env, method, path, body) {
  const token = await getToken(env);
  const r = await fetch(paypalBase(env) + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = { raw: text }; }
  return { status: r.status, json: j };
}

export async function d1(env, sql) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return { error: 'NO_CRED' };
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${ANALYTICS_DB}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const j = await r.json();
  if (!j.success) return { error: (j.errors && j.errors[0] && j.errors[0].message) || 'D1_FAIL' };
  return j.result || [];
}

export async function recordOrder(env, o) {
  await d1(env, `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, source TEXT, item TEXT, sku TEXT,
    payer_email TEXT, contact_email TEXT, amount REAL, currency TEXT,
    paypal_order_id TEXT, status TEXT, note TEXT, created INTEGER
  )`);
  const esc = s => String(s == null ? '' : s).replace(/'/g, "''");
  const sql = `INSERT OR REPLACE INTO orders (id, source, item, sku, payer_email, contact_email, amount, currency, paypal_order_id, status, note, created) VALUES ('${esc(o.id)}','${esc(o.source)}','${esc(o.item)}','${esc(o.sku)}','${esc(o.payer_email)}','${esc(o.contact_email)}',${o.amount || 0},'${esc(o.currency || 'CNY')}','${esc(o.paypal_order_id)}','${esc(o.status)}','${esc(o.note)}',${o.created || Date.now()})`;
  return d1(env, sql);
}

export async function notifyOwner(env, subject, html) {
  if (!env.RESEND_API_KEY) return { skipped: true };
  const to = env.NOTIFY_EMAIL || NOTIFY_TO;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { error: d.message || ('HTTP ' + r.status) };
    return { ok: true, id: d.id };
  } catch (e) { return { error: e.message }; }
}

export function beijing() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function json(o, s = 200) {
  return new Response(JSON.stringify(o), {
    status: s,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
  });
}
export function corsOptions() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
