import { ITEMS, pp, recordOrder, notifyOwner, beijing, json, corsOptions } from './_lib.js';

export async function onRequestOptions() { return corsOptions(); }

// POST /api/paypal/capture  { orderId, item?, email? }
// 用户从 PayPal 回跳后，服务端二次确认金额并捕获，再写订单 + 通知
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'JSON 格式错误' }, 400); }
  const orderId = String(body.orderId || '');
  let key = String(body.item || '');
  const email = String(body.email || '').slice(0, 120);
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

    // 2) 二次确认金额
    const pu = get.json.purchase_units && get.json.purchase_units[0];
    const amt = pu && pu.amount && pu.amount.value;
    if (amt !== item.price.toFixed(2)) return json({ ok: false, error: '金额不符，已拦截' }, 400);

    // 3) 捕获
    const cap = await pp(env, 'POST', '/v2/checkout/orders/' + orderId + '/capture');
    if (cap.status !== 201) return json({ ok: false, error: '捕获失败: ' + JSON.stringify(cap.json).slice(0, 200) }, 500);

    // 4) 记录 + 通知
    const payerEmail = (cap.json.payer && cap.json.payer.email_address) || '';
    const id = 'or_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const d1r = await recordOrder(env, {
      id, source: 'paypal', item: item.name, sku: key,
      payer_email: payerEmail, contact_email: email,
      amount: item.price, currency: 'CNY', paypal_order_id: orderId, status: 'paid',
    });
    if (d1r && d1r.error) return json({ ok: false, error: '订单存档失败: ' + d1r.error }, 500);

    const t = beijing();
    await notifyOwner(env,
      `【RCJ 收款】${item.name} ¥${item.price}`,
      `<p>时间（北京）：${t}</p><p>商品：${item.name}</p><p>付款邮箱：${payerEmail || '(未知)'}</p><p>联系邮箱：${email || '(未填)'}</p><p>PayPal 订单：${orderId}</p>`
    );

    return json({ ok: true, status: 'paid', id });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
