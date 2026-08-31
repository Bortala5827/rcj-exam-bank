import { ITEMS, pp, paypalCurrency, json, corsOptions } from './_lib.js';

export async function onRequestOptions() { return corsOptions(); }

// POST /api/paypal/create-order  { item, email }
// 服务端创建 PayPal 订单，返回 approveUrl 供前端直接跳转 PayPal 托管收银台
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'JSON 格式错误' }, 400); }
  const key = String(body.item || '');
  const item = ITEMS[key];
  if (!item) return json({ ok: false, error: '商品不存在' }, 400);
  const email = String(body.email || '').slice(0, 120);

  // 回跳地址：把 item/email 带在 query 里，PayPal 会追加 &token=&PayerID=
  const returnUrl = `https://exam.955827.xyz/shop/return.html?item=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}`;
  const cancelUrl = `https://exam.955827.xyz/shop/return.html?cancel=1`;

  try {
    const res = await pp(env, 'POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        description: 'RCJ · ' + item.name,
        custom_id: key,
        amount: { currency_code: paypalCurrency(env), value: item.price.toFixed(2) },
      }],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        brand_name: 'RCJ Lab',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
      },
    });
    if (res.status !== 201) {
      return json({ ok: false, error: '创建订单失败: ' + ((res.json.error_description) || JSON.stringify(res.json)).slice(0, 200) }, 500);
    }
    const links = res.json.links || [];
    const approve = links.find(l => l.rel === 'approve');
    if (!approve) return json({ ok: false, error: '未返回支付链接' }, 500);
    return json({ ok: true, id: res.json.id, approveUrl: approve.href, email });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
