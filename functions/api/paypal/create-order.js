import { ITEMS, pp, paypalCurrency, resolveCurrency, toCurrency, langCurrency, json, corsOptions } from './_lib.js';

export async function onRequestOptions() { return corsOptions(); }

// POST /api/paypal/create-order  { item, email, currency? }
// 服务端创建 PayPal 订单，返回 approveUrl 供前端直接跳转 PayPal 托管收银台
// currency 跟随前端语言：zh→CNY，en/ja→USD（缺省回退到 paypalCurrency(env)）
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'JSON 格式错误' }, 400); }
  const key = String(body.item || '');
  const item = ITEMS[key];
  if (!item) return json({ ok: false, error: '商品不存在' }, 400);
  const email = String(body.email || '').slice(0, 120);

  // 货币：前端语言决定；非法值回退到账户默认；账号不支持 CNY 时统一回落 USD
  const wanted = (body.currency === 'CNY' || body.currency === 'USD')
    ? body.currency
    : (langCurrency(body.lang) || paypalCurrency(env));
  const currency = resolveCurrency(env, wanted);
  const amountVal = toCurrency(item.deposit, currency).toFixed(2);

  // 回跳地址：把 item/email/cur 带在 query 里，PayPal 会追加 &token=&PayerID=
  const returnUrl = `https://exam.955827.xyz/shop/return.html?item=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&cur=${encodeURIComponent(currency)}`;
  const cancelUrl = `https://exam.955827.xyz/shop/return.html?cancel=1`;

  try {
    const res = await pp(env, 'POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        description: 'RCJ · ' + item.name + '（定金）',
        custom_id: key,
        amount: { currency_code: currency, value: amountVal },
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
    return json({ ok: true, id: res.json.id, approveUrl: approve.href, email, currency, amount: amountVal });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
