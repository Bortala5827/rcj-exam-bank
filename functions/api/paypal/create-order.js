import { ITEMS, pp, paypalCurrency, json, corsOptions } from './_lib.js';

export async function onRequestOptions() { return corsOptions(); }

// POST /api/paypal/create-order  { item, email }
// 服务端创建 PayPal 订单，返回 order id 给前端 SDK 用
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'JSON 格式错误' }, 400); }
  const key = String(body.item || '');
  const item = ITEMS[key];
  if (!item) return json({ ok: false, error: '商品不存在' }, 400);
  const email = String(body.email || '').slice(0, 120);

  try {
    const res = await pp(env, 'POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        description: 'RCJ · ' + item.name,
        custom_id: key,
        amount: { currency_code: paypalCurrency(env), value: item.price.toFixed(2) },
      }],
    });
    if (res.status !== 201) {
      return json({ ok: false, error: '创建订单失败: ' + ((res.json.error_description) || JSON.stringify(res.json)).slice(0, 200) }, 500);
    }
    return json({ ok: true, id: res.json.id, email });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
