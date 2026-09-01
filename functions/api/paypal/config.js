import { ITEMS, CNY_PER_USD, accountSupportsCNY } from './_lib.js';

// GET /api/paypal/config  → 给前端 SDK 用的 clientId / 模式 / 商品列表
export async function onRequestGet({ env }) {
  const items = Object.keys(ITEMS).map(k => ({ key: k, name: ITEMS[k].name, price: ITEMS[k].price, deposit: ITEMS[k].deposit, balance: ITEMS[k].balance }));
  return new Response(JSON.stringify({
    clientId: env.PAYPAL_CLIENT_ID || '',
    mode: env.PAYPAL_MODE || 'sandbox',
    rate: CNY_PER_USD,
    cnyEnabled: accountSupportsCNY(env),
    items,
  }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
