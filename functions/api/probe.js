/* Groq 403 诊断探针（临时）
 * 访问 https://exam.955827.xyz/api/probe
 * 回显 Pages Function 执行落区（colo/country）+ 该落区直连 Groq 的状态：
 *   200 = 通；401 = key 未配置/无效；403 = 出口区域被封
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const cf = request.cf || {};
  const out = {
    time: new Date().toISOString(),
    info: {
      colo: cf.colo || null,
      country: cf.country || null,
      city: cf.city || null,
      region: cf.region || null,
    },
    groq: null,
  };

  try {
    const key = (env && env.GROQ_API_KEY) || "";
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + key,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      }),
    });
    const txt = await r.text();
    out.groq = { status: r.status, body: txt.slice(0, 400) };
  } catch (e) {
    out.groq = { error: String((e && e.message) || e) };
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
