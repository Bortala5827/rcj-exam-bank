import { ITEMS, pp, recordOrder, notifyOwner, beijing, json, corsOptions } from './_lib.js';

export async function onRequestOptions() { return corsOptions(); }

// POST /api/paypal/capture  { orderId, item, email }
// 前端 PayPal 批准后，服务端二次确认金额并捕获，再写订单 + 通知
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'JSON 格式错误' }, 400); }
  const orderId = String(body.orderId || '');
  const key = String(body.item || '');
  const item = ITEMS[key];
  if (!item || !orderId) return json({ ok: false, error: '参数缺失' }, 400);

  try {
    // 1) 二次确认订单金额
    const get = await pp(env, 'GET', '/v2/checkout/orders/' + orderId);
    if (get.status !== 200) return json({ ok: false, error: '订单查询失败' }, 400);
    const pu = get.json.purchase_units && get.json.purchase_units[0];
    const amt = pu && pu.amount && pu.amount.value;
    if (amt !== item.price.toFixed(2)) return json({ ok: false, error: '金额不符，已拦截' }, 400);

    // 2) 捕获
    const cap = await pp(env, 'POST', '/v2/checkout/orders/' + orderId + '/capture');
    if (cap.status !== 201) return json({ ok: false, error: '捕获失败: ' + JSON.stringify(cap.json).slice(0, 200) }, 500);

    // 3) 记录 + 通知
    const payerEmail = (cap.json.payer && cap.json.payer.email_address) || '';
    const contact = String(body.email || '').slice(0, 120);
    const id = 'or_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const d1r = await recordOrder(env, {
      id, source: 'paypal', item: item.name, sku: key,
      payer_email: payerEmail, contact_email: contact,
      amount: item.price, currency: 'CNY', paypal_order_id: orderId, status: 'paid',
    });
    if (d1r && d1r.error) return json({ ok: false, error: '订单存档失败: ' + d1r.error }, 500);

    const t = beijing();
    await notifyOwner(env,
      `【RCJ 收款】${item.name} ¥${item.price}`,
      `<p>时间（北京）：${t}</p><p>商品：${item.name}</p><p>付款邮箱：${payerEmail || '(未知)'}</p><p>联系邮箱：${contact || '(未填)'}</p><p>PayPal 订单：${orderId}</p>`
    );

    return json({ ok: true, status: 'paid', id });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
