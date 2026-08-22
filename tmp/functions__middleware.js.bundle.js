// functions/_middleware.js
var LIMIT_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>\u4ECA\u65E5\u514D\u8D39\u4F53\u9A8C\u5DF2\u8FBE\u4E0A\u9650</title>
<style>
  body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef2f7;color:#1e3a5f;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .box{max-width:440px;background:#fff;padding:34px 30px;border-radius:18px;box-shadow:0 10px 36px rgba(30,58,95,.12);text-align:center}
  .emoji{font-size:44px;line-height:1}
  .t{font-size:21px;font-weight:800;margin:14px 0 10px}
  .d{font-size:14px;color:#4a5568;line-height:1.8}
  .d b{color:#1e3a5f}
  .b{display:inline-block;margin-top:20px;background:#1e3a5f;color:#fff;padding:11px 20px;border-radius:11px;text-decoration:none;font-size:14px;font-weight:600}
  .b:hover{opacity:.92}
</style></head><body><div class="box">
  <div class="emoji">\u{1F6A7}</div>
  <h1 class="t">\u4ECA\u65E5\u514D\u8D39\u4F53\u9A8C\u5DF2\u8FBE\u4E0A\u9650</h1>
  <p class="d">\u672C\u5F00\u6E90\u9898\u5E93\u4E3A<b>\u5F15\u6D41\u4F53\u9A8C\u7248</b>\uFF0C\u6BCF\u4F4D\u8BBF\u5BA2\u6BCF\u65E5\u53EF\u514D\u8D39\u6D4F\u89C8\u82E5\u5E72\u6B21\u3002<br><br>
  \u9700\u8981<b>\u5168\u91CF\u771F\u9898 + AI \u667A\u80FD\u70B9\u8BC4\uFF08\u5F55\u97F3\u5373\u51FA\u5206\uFF09+ \u79BB\u7EBF\u65E0\u5E7F\u544A\u7248</b>\uFF0C\u8BF7\u53BB\u95F2\u9C7C\u641C <b>RCJ9527</b> \u83B7\u53D6\u5B8C\u6574\u7248\u3002</p>
  <a class="b" href="https://www.goofish.com/" target="_blank" rel="noopener">\u53BB\u95F2\u9C7C\u641C RCJ9527 \u2192</a>
</div></body></html>`;
var OFFLINE_AT_DEFAULT = 0;
var TRIAL_DAYS_DEFAULT = 0;
var TRIAL_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>\u514D\u8D39\u8BD5\u7528\u5DF2\u7ED3\u675F</title>
<style>
  body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef2f7;color:#1e3a5f;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .box{max-width:400px;background:#fff;padding:36px 30px;border-radius:18px;box-shadow:0 10px 36px rgba(30,58,95,.12);text-align:center}
  .emoji{font-size:42px;line-height:1;margin-bottom:12px}
  .t{font-size:21px;font-weight:800;margin:0 0 12px}
  .d{font-size:14px;color:#4a5568;line-height:1.9;margin:0}
  .d b{color:#1e3a5f}
  .b{display:inline-block;margin-top:22px;background:#1e3a5f;color:#fff;padding:12px 22px;border-radius:11px;text-decoration:none;font-size:14px;font-weight:600}
  .b:hover{opacity:.92}
</style></head><body><div class="box">
  <div class="emoji">\u23F3</div>
  <h1 class="t">\u514D\u8D39\u8BD5\u7528\u5DF2\u7ED3\u675F</h1>
  <p class="d">3 \u5929\u5728\u7EBF\u8BD5\u7528\u671F\u5DF2\u6EE1\u3002<br>\u9700\u7EE7\u7EED\u4F7F\u7528\u8BF7\u83B7\u53D6<b>\u79BB\u7EBF\u5B8C\u6574\u7248</b>\uFF08\u5168\u91CF\u771F\u9898\xB7AI \u70B9\u8BC4\xB7\u6C38\u4E45\u4F7F\u7528\uFF09\u3002<br>\u83B7\u53D6\u65B9\u5F0F\uFF1A\u95F2\u9C7C\u641C <b>RCJ9527</b></p>
  <a class="b" href="https://www.goofish.com/" target="_blank" rel="noopener">\u53BB\u95F2\u9C7C\u641C RCJ9527 \u2192</a>
</div></body></html>`;
function trialBannerHtml(trialEnd) {
  return '<style>#rcjTrialBar{position:fixed;top:0;left:0;right:0;z-index:2147483600;background:linear-gradient(90deg,#b45309,#d97706);color:#fff;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.5;padding:7px 12px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.15)}#rcjTrialBar b{font-weight:800}#rcjTrialBar #rcjTrialCd{font-variant-numeric:tabular-nums;background:rgba(255,255,255,.18);padding:1px 7px;border-radius:6px;margin:0 2px}#rcjTrialBar a{color:#fff;text-decoration:underline;font-weight:700;white-space:nowrap}@media(max-width:520px){#rcjTrialBar{font-size:12px;padding:6px 10px}}</style><div id="rcjTrialBar">\u{1F381} \u514D\u8D39\u8BD5\u7528\u4E2D \xB7 \u5269\u4F59 <b id="rcjTrialCd">--</b> \xB7 \u957F\u671F\u4F7F\u7528\u8BF7\u83B7\u53D6\u79BB\u7EBF\u5B8C\u6574\u7248\uFF08\u95F2\u9C7C\u641C <a href="https://www.goofish.com/" target="_blank" rel="noopener">RCJ9527</a>\uFF09</div><script>(function(){var T=' + trialEnd + ';function tick(){var d=T-Date.now();if(d<=0){location.reload();return;}var day=Math.floor(d/86400000),h=Math.floor(d%86400000/3600000),m=Math.floor(d%3600000/60000);var s=(day>0?day+" \u5929 ":"")+h+" \u5C0F\u65F6 "+m+" \u5206";var el=document.getElementById("rcjTrialCd");if(el)el.textContent=s;}function boot(){var bar=document.getElementById("rcjTrialBar");if(!bar)return;tick();setInterval(tick,15000);try{document.body.style.paddingTop=((bar.offsetHeight||34))+"px";}catch(e){}}if(document.body){boot();}else{document.addEventListener("DOMContentLoaded",boot);}})();<\/script>';
}
function withTrial(res, trialStart, trialEnd, trialDays) {
  if (trialDays <= 0) return res;
  res.headers.append(
    "Set-Cookie",
    `rcj_trial=${trialStart}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
  );
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;
  return new HTMLRewriter().on("body", { element(el) {
    el.append(trialBannerHtml(trialEnd), { html: true });
  } }).transform(res);
}
var OFFLINE_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>\u7F51\u7AD9\u5347\u7EA7\u7EF4\u62A4\u4E2D</title>
<style>
  body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef2f7;color:#1e3a5f;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .box{max-width:400px;background:#fff;padding:36px 30px;border-radius:18px;box-shadow:0 10px 36px rgba(30,58,95,.12);text-align:center}
  .emoji{font-size:42px;line-height:1;margin-bottom:12px}
  .t{font-size:21px;font-weight:800;margin:0 0 12px}
  .d{font-size:14px;color:#4a5568;line-height:1.9;margin:0}
  .d b{color:#1e3a5f}
  .b{display:inline-block;margin-top:22px;background:#1e3a5f;color:#fff;padding:12px 22px;border-radius:11px;text-decoration:none;font-size:14px;font-weight:600}
  .b:hover{opacity:.92}
</style></head><body><div class="box">
  <div class="emoji">\u{1F6E0}\uFE0F</div>
  <h1 class="t">\u7F51\u7AD9\u5347\u7EA7\u7EF4\u62A4\u4E2D</h1>
  <p class="d">\u5728\u7EBF\u7248\u6682\u505C\u5F00\u653E\u3002<br><b>\u79BB\u7EBF\u5B8C\u6574\u7248\u4E0D\u53D7\u5F71\u54CD</b>\uFF0C\u53EF\u6B63\u5E38\u5237\u9898\uFF0C\u8054\u7F51\u5373\u53EF\u4F7F\u7528 AI \u70B9\u8BC4\u3002<br>\u83B7\u53D6\u79BB\u7EBF\u5B8C\u6574\u7248\uFF1A\u95F2\u9C7C\u641C <b>RCJ9527</b></p>
  <a class="b" href="https://www.goofish.com/" target="_blank" rel="noopener">\u53BB\u95F2\u9C7C\u641C RCJ9527 \u2192</a>
</div></body></html>`;
function bannerHtml(offlineAt) {
  return '<style>#rcjOfflineBar{position:fixed;top:0;left:0;right:0;z-index:2147483600;background:linear-gradient(90deg,#e11d48,#b91c1c);color:#fff;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.5;padding:8px 12px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.18)}#rcjOfflineBar b{font-weight:800}#rcjOfflineBar #rcjOfflineCd{font-variant-numeric:tabular-nums;background:rgba(255,255,255,.18);padding:1px 7px;border-radius:6px;margin:0 2px}#rcjOfflineBar a{color:#fff;text-decoration:underline;font-weight:700;white-space:nowrap}@media(max-width:520px){#rcjOfflineBar{font-size:12px;padding:7px 10px}}</style><div id="rcjOfflineBar">\u{1F6E0}\uFE0F \u672C\u7AD9\u5373\u5C06\u8FDB\u5165\u5347\u7EA7\u7EF4\u62A4\u3001\u5728\u7EBF\u7248\u6682\u505C\u5F00\u653E \xB7 \u5269\u4F59 <b id="rcjOfflineCd">--:--:--</b> \xB7 \u9700\u957F\u671F\u4F7F\u7528\u8BF7\u83B7\u53D6\u79BB\u7EBF\u5B8C\u6574\u7248\uFF08\u95F2\u9C7C\u641C <a href="https://www.goofish.com/" target="_blank" rel="noopener">RCJ9527</a>\uFF09</div><script>(function(){var T=' + offlineAt + ';function p(n){return n<10?"0"+n:""+n;}function tick(){var d=T-Date.now();if(d<=0){location.reload();return;}var h=Math.floor(d/3600000),m=Math.floor(d%3600000/60000),s=Math.floor(d%60000/1000);var el=document.getElementById("rcjOfflineCd");if(el)el.textContent=p(h)+":"+p(m)+":"+p(s);}function boot(){var bar=document.getElementById("rcjOfflineBar");if(!bar)return;tick();setInterval(tick,1000);try{document.body.style.paddingTop=((bar.offsetHeight||40))+"px";}catch(e){}}if(document.body){boot();}else{document.addEventListener("DOMContentLoaded",boot);}})();<\/script>';
}
function injectBanner(res, offlineAt) {
  if (!offlineAt || offlineAt <= 0) return res;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;
  return new HTMLRewriter().on("body", { element(el) {
    el.append(bannerHtml(offlineAt), { html: true });
  } }).transform(res);
}
function isBot(req) {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (!ua) return true;
  const bad = [
    "bot",
    "crawler",
    "spider",
    "slurp",
    "bingpreview",
    "facebookexternalhit",
    "python-requests",
    "curl",
    "wget",
    "go-http-client",
    "okhttp",
    "headless",
    "phantomjs",
    "puppeteer",
    "selenium",
    "axios",
    "java/",
    "libwww",
    "scrapy",
    "httpclient",
    "zgrab",
    "masscan",
    "nmap",
    "semrush",
    "ahrefs",
    "mj12bot",
    "dotbot",
    "petalbot",
    "applebot",
    "yandex",
    "baiduspider",
    "googlebot",
    "censys",
    "archive",
    "whatsapp",
    "telegrambot"
  ];
  return bad.some((b) => ua.includes(b));
}
function injectGa4(res, ga4Id) {
  if (!ga4Id) return res;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;
  const s = '<script async src="https://www.googletagmanager.com/gtag/js?id=' + ga4Id + '"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","' + ga4Id + '");<\/script>';
  return new HTMLRewriter().on("head", { element(el) {
    el.append(s, { html: true });
  } }).transform(res);
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
async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const cookie = request.headers.get("cookie") || "";
  const VIP_SECRET = env && env.VIP_SECRET || "rcj9527-vip-KZ9qu6kWkSH1uujsbn_3_QL6";
  const DAILY_LIMIT = parseInt(env && env.DAILY_LIMIT || "30", 10);
  const allowIps = env && env.ALLOW_IPS ? env.ALLOW_IPS.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const limit = DAILY_LIMIT;
  const ga4Id = env && env.GA4_ID || "";
  if (VIP_SECRET && url.searchParams.get("vip") === VIP_SECRET) {
    const res2 = await next();
    res2.headers.append(
      "Set-Cookie",
      "rcj_vip=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure"
    );
    return res2;
  }
  if (cookie.includes("rcj_vip=1")) return next();
  if (url.pathname.startsWith("/api/")) return next();
  const ip = request.headers.get("cf-connecting-ip") || "";
  if (ip && allowIps.includes(ip)) return next();
  const isStatic = /\.(js|css|png|jpe?g|gif|svg|json|webp|mp3|mp4|woff2?|ttf|map|ico)$/i.test(
    url.pathname
  );
  const OFFLINE_AT = parseInt(env && env.OFFLINE_AT || String(OFFLINE_AT_DEFAULT), 10) || 0;
  if (OFFLINE_AT > 0 && Date.now() >= OFFLINE_AT) {
    if (!isStatic && request.method === "GET") {
      return new Response(OFFLINE_HTML, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }
    return next();
  }
  if (isStatic || request.method !== "GET") return next();
  if (isBot(request)) return next();
  const TRIAL_DAYS = parseInt(env && env.TRIAL_DAYS || String(TRIAL_DAYS_DEFAULT), 10);
  let trialStart = 0, trialEnd = 0;
  if (TRIAL_DAYS > 0) {
    const tm = cookie.match(/rcj_trial=(\d+)/);
    if (tm) trialStart = parseInt(tm[1], 10) || 0;
    if (trialStart <= 0 || trialStart > Date.now()) trialStart = Date.now();
    trialEnd = trialStart + TRIAL_DAYS * 864e5;
    if (Date.now() >= trialEnd) {
      return new Response(TRIAL_HTML, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const db = getDB(env);
  if (db) {
    const ipKey = ip || "unknown";
    let n = 0;
    try {
      const row = await db.prepare("SELECT n FROM visit_counts WHERE ip=? AND day=?").bind(ipKey, today).all();
      n = row.results.length ? Number(row.results[0].n) || 0 : 0;
    } catch (e) {
      n = 0;
    }
    if (n >= limit) {
      return new Response(LIMIT_HTML, {
        status: 429,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "retry-after": "86400",
          "cache-control": "no-store"
        }
      });
    }
    const res2 = await next();
    try {
      await db.prepare(
        "INSERT INTO visit_counts (ip,day,n) VALUES (?,?,1) ON CONFLICT(ip,day) DO UPDATE SET n = n + 1"
      ).bind(ipKey, today).run();
    } catch (e) {
    }
    return injectGa4(withTrial(injectBanner(res2, OFFLINE_AT), trialStart, trialEnd, TRIAL_DAYS), ga4Id);
  }
  let visits = 0;
  try {
    const m = cookie.match(/rcj_visits=([^;]+)/);
    if (m) {
      const o = JSON.parse(decodeURIComponent(m[1]));
      if (o && o.d === today) visits = o.n || 0;
    }
  } catch (e) {
    visits = 0;
  }
  if (visits >= limit) {
    return new Response(LIMIT_HTML, {
      status: 429,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "retry-after": "86400",
        "cache-control": "no-store"
      }
    });
  }
  const res = await next();
  const nextVal = encodeURIComponent(JSON.stringify({ d: today, n: visits + 1 }));
  res.headers.append(
    "Set-Cookie",
    `rcj_visits=${nextVal}; Path=/; Max-Age=86400; SameSite=Lax; Secure`
  );
  return injectGa4(withTrial(injectBanner(res, OFFLINE_AT), trialStart, trialEnd), ga4Id);
}
export {
  onRequest
};
