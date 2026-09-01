// PayPal + 订单/通知 共享库（rcj-exam-bank Pages Functions）
// 沙盒默认；PAYPAL_MODE=live 切正式。
const ANALYTICS_DB = 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828'; // rcj-analytics-d1
const NOTIFY_TO = '1430115702@qq.com';
const EMAIL_FROM = 'RCJ 商店 <noreply@955827.xyz>';

// 商品定义（与 shop 右侧卡片一致）
// 定金模式：先付小额定金锁定，余款交付时通过微信/支付宝收。
// DEPOSIT_RATE 为自定义服务的定金比例；hosting 金额太小直接全款（deposit 显式=全价）。
export const DEPOSIT_RATE = 0.10; // 10%。改这里即可：0.05=5% / 0.30=30%
export const ITEMS = {
  'hosting':       { name: '代托管',   price: 9.9, sku: 'hosting', deposit: 9.9 },
  'question-bank': { name: '题库定制', price: 39,  sku: 'question-bank' },
  'build':         { name: '纯建站',   price: 69,  sku: 'build' },
};
// 未显式指定 deposit 的，按 DEPOSIT_RATE 计算定金；并算出余款
for (const k in ITEMS) {
  const it = ITEMS[k];
  if (it.deposit == null) it.deposit = +(it.price * DEPOSIT_RATE).toFixed(2);
  it.balance = +(it.price - it.deposit).toFixed(2);
}

export function paypalBase(env) {
  return (env.PAYPAL_MODE === 'live') ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

// 货币：默认沙盒用 USD（沙盒账户多为美元户，CNY 不被支持），live 用 CNY（你的 RMB 定价）。
// 如需强制指定，设 PAYPAL_CURRENCY 密钥（如 CNY / USD）。
export function paypalCurrency(env) {
  if (env.PAYPAL_CURRENCY) return env.PAYPAL_CURRENCY;
  return (env.PAYPAL_MODE === 'live') ? 'CNY' : 'USD';
}

// 账号是否支持 CNY 收款。
// 海外注册的 PayPal 多为美元户，收 CNY 会直接报 CURRENCY_NOT_SUPPORTED，
// 故默认关闭：凡要收 CNY 的场合一律回落 USD（前台仍按人民币标价展示，只是实扣美元）。
// 账号若开通人民币收款，设 PAYPAL_CNY_ENABLED=true（或 PAYPAL_CURRENCY=CNY）即可启用。
export function accountSupportsCNY(env) {
  if (env.PAYPAL_CURRENCY) return env.PAYPAL_CURRENCY === 'CNY';
  return env.PAYPAL_CNY_ENABLED === 'true';
}
// 货币回落：账号不支持 CNY 时，CNY → USD
export function resolveCurrency(env, currency) {
  if (currency === 'CNY' && !accountSupportsCNY(env)) return 'USD';
  return currency;
}

// 语言→货币：中文用人民币，英文/日文用美元（面向国际访客，PayPal 默认美元户）
export const CNY_PER_USD = 7.2; // 1 美元 ≈ 7.2 元；改这里即可统一调汇率
export function langCurrency(lang) { return lang === 'zh' ? 'CNY' : 'USD'; }
export function toCurrency(cny, currency) {
  if (currency === 'CNY') return +(+cny).toFixed(2);
  return +(+cny / CNY_PER_USD).toFixed(2);
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
    full_price REAL, balance REAL, cny_amount REAL, paypal_order_id TEXT, status TEXT, note TEXT, created INTEGER
  )`);
  // 幂等迁移：老版本建的 orders 表可能缺列，探测后补上
  const probe = await d1(env, 'SELECT full_price FROM orders LIMIT 0');
  if (probe && probe.error && /full_price|no such column/i.test(probe.error)) {
    await d1(env, 'ALTER TABLE orders ADD COLUMN full_price REAL');
    await d1(env, 'ALTER TABLE orders ADD COLUMN balance REAL');
  }
  const probe2 = await d1(env, 'SELECT cny_amount FROM orders LIMIT 0');
  if (probe2 && probe2.error && /cny_amount|no such column/i.test(probe2.error)) {
    await d1(env, 'ALTER TABLE orders ADD COLUMN cny_amount REAL');
    await d1(env, 'UPDATE orders SET cny_amount = amount WHERE cny_amount IS NULL');
  }
  const esc = s => String(s == null ? '' : s).replace(/'/g, "''");
  const n = v => (v == null ? 'NULL' : v);
  const sql = `INSERT OR REPLACE INTO orders (id, source, item, sku, payer_email, contact_email, amount, currency, full_price, balance, cny_amount, paypal_order_id, status, note, created) VALUES ('${esc(o.id)}','${esc(o.source)}','${esc(o.item)}','${esc(o.sku)}','${esc(o.payer_email)}','${esc(o.contact_email)}',${n(o.amount)},'${esc(o.currency || 'CNY')}',${n(o.full_price)},${n(o.balance)},${n(o.cny_amount)},'${esc(o.paypal_order_id)}','${esc(o.status)}','${esc(o.note)}',${o.created || Date.now()})`;
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

export async function notifyTelegram(env, text) {
  const token = env.TG_BOT_TOKEN, chat = env.TG_CHAT_ID;
  if (!token || !chat) return { skipped: true };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { error: d.description || ('HTTP ' + r.status) };
    return { ok: true, id: d.result && d.result.message_id };
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
