import { ITEMS, pp, recordOrder, notifyTelegram, beijing, resolveCurrency, toCurrency, CNY_PER_USD, json, corsOptions } from './_lib.js';

export async function onRequestOptions() { return corsOptions(); }

// POST /api/paypal/capture  { orderId, item?, email?, currency? }
// 用户从 PayPal 回跳后，服务端二次确认金额并捕获，再写订单 + 通知（邮件 + Telegram）
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'JSON 格式错误' }, 400); }
  const orderId = String(body.orderId || '');
  let key = String(body.item || '');
  const email = String(body.email || '').slice(0, 120);
  // 与建单保持同一套回落规则，避免「建单 USD / 校验 CNY」导致金额不符被拦截
  const currency = resolveCurrency(env, body.currency === 'CNY' || body.currency === 'USD' ? body.currency : 'CNY');
  if (!orderId) return json({ ok: false, error: '参数缺失' }, 400);

  try {
    // 1) 查询订单，还原商品（custom_id 兜底，前端没传也能用）
    const get = await pp(env, 'GET', '/v2/checkout/orders/' + orderId);
    if (get.status !== 200) return json({ ok: false, error: '订单查询失败' }, 400);
    if (!key && get.json.purchase_units && get.json.purchase_units[0]) {
      key = get.json.purchase_units[0].custom_id || '';
    }
    const item = ITEMS[key];
    if (!item) return json({ ok: false, error: '商品不匹配' }, 400);

    // 2) 二次确认金额（应与定金一致，防止篡改；金额按本单货币校验）
    const pu = get.json.purchase_units && get.json.purchase_units[0];
    const amt = pu && pu.amount && pu.amount.value;
    const expected = toCurrency(item.deposit, currency).toFixed(2);
    if (amt !== expected) return json({ ok: false, error: '金额不符，已拦截(' + amt + '≠' + expected + ')' }, 400);

    // 3) 捕获
    const cap = await pp(env, 'POST', '/v2/checkout/orders/' + orderId + '/capture');
    if (cap.status !== 201) return json({ ok: false, error: '捕获失败: ' + JSON.stringify(cap.json).slice(0, 200) }, 500);

    // 4) 金额换算：本单以 currency 计，cny_amount 统一折算人民币便于后台汇总
    const payerEmail = (cap.json.payer && cap.json.payer.email_address) || '';
    const paidAmt = toCurrency(item.deposit, currency);
    const cnyAmt = currency === 'CNY' ? paidAmt : +(paidAmt * CNY_PER_USD).toFixed(2);
    const id = 'or_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const d1r = await recordOrder(env, {
      id, source: 'paypal', item: item.name, sku: key,
      payer_email: payerEmail, contact_email: email,
      amount: paidAmt, currency,
      full_price: toCurrency(item.price, currency), balance: toCurrency(item.balance, currency), cny_amount: cnyAmt,
      paypal_order_id: orderId, status: 'deposit',
    });
    if (d1r && d1r.error) return json({ ok: false, error: '订单存档失败: ' + d1r.error }, 500);

    const t = beijing();
    const curSym = currency === 'CNY' ? '¥' : '$';
    const line = `【RCJ 收款】${item.name} 定金 ${curSym}${paidAmt}（${currency}）\n🕒 ${t}\n商品：${item.name}\n已收定金：${curSym}${paidAmt}（余款 ${curSym}${toCurrency(item.balance, currency)} 待交付时收）\n付款邮箱：${payerEmail || '(未知)'}\n联系邮箱：${email || '(未填)'}\nPayPal 单：${orderId}`;
    // 订单通知走 Telegram（省邮件额度；邮件仅留给客服系统）
    await notifyTelegram(env, line);

    return json({ ok: true, status: 'paid', id });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
