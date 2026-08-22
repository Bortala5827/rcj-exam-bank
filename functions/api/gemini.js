/* Gemini / b.ai / dots3 多源反代（Cloudflare Pages Function）
 * 部署后访问: https://exam.955827.xyz/api/gemini
 *
 * 模式：
 *   POST { topic: "主题" }                 → 生成知识卡片（仅 Gemini，含联网搜索）
 *   POST { prompt: "指令" }                 → 通用调用（仅 Gemini）
 *   POST { mode: "relate", hook, concept, nodes } → AI 关联（dots / bai / custom 可切换）
 *
 * 安全：
 *   API Key 在 Cloudflare 后台 → Settings → Variables 加密存储，代码里不写 Key。
 *   custom 源：用户在前端填自己的 OpenAI 兼容接口，仅本次请求透传，不落库；
 *             强制 https + 内网地址拦截，防 SSRF。
 *
 * 环境变量：
 *   GEMINI_API_KEY        Gemini key（topic/prompt 模式必填）
 *   GEMINI_MODEL          默认 gemini-3.5-flash-lite，可覆盖
 *   AI_PROVIDER           relate 模式走哪个源：dots（默认）| bai | openrouter | custom
 *   BAI_API_KEY           b.ai key（AI_PROVIDER=bai 时必填）
 *   BAI_MODEL             b.ai 模型 id，默认 deepseek-v4-flash（免费）；也可 hy3
 *   BAI_BASE              b.ai API base，默认 https://api.b.ai/v1
 *   注：b.ai 免费模型强制 stream=true，本 handler 按流式读取 SSE 后聚合。
 *   DOTS_API_KEY          dots3（小红书自研）key（AI_PROVIDER=dots 时必填），鉴权头为 api-key（非 Bearer）
 *   DOTS_MODEL            dots3 模型 id，默认 dots3-note-prev
 *   DOTS_BASE             dots3 API base，默认 https://note3-prev-api.askdiandian.com
 *   OPENROUTER_API_KEY    OpenRouter key（AI_PROVIDER=openrouter 时必填）
 *   OPENROUTER_MODEL      OpenRouter 模型 id，默认 stealth/ox-alpha
 *   OPENROUTER_BASE       OpenRouter API base，默认 https://openrouter.ai/api/v1
 *   注：openrouter 为 OpenAI 兼容，Bearer 鉴权，支持流式。
 */

// 模型名：gemini-3.5-flash-lite（实测可用）。
// 可在 CF 后台 Settings → Variables 用 GEMINI_MODEL 覆盖，不配则走默认。
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const BAI_BASE = "https://api.b.ai/v1";
const DOTS_BASE = "https://note3-prev-api.askdiandian.com/v1";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const CARD_SYSTEM = `你是一个极具洞察力的政治、社会、商业、科技、历史专家与资深面试官。你的任务是根据用户提供的核心主题，将其拆解并扩展为一套可供"刷卡式学习"的"知识牌堆（Knowledge Cards）"以及相关的"延伸话题（Extended Topics）"。

# Output Format Constraints
你必须严格输出合法的 JSON 格式数据，不能包含任何 Markdown 标记（如 json 等），不能包含首尾空格、解释性文字。

# Rules for Content Generation
1. 知识牌堆（cards）：
   - 每次固定生成 5 张内容紧凑的知识卡。
   - 每张卡片的 title 必须控制在 12 个字以内，必须具有极强的吸引力。
   - 每张卡片的 content 必须精简且信息密度极高，采用 Markdown 的无序列表（- ）形式展示核心事实。文字要直白、易懂、短句为主，严禁废话。
2. 延伸话题（extended_topics）：
   - 固定生成 3 个延伸话题。
   - 必须提供明确的 tag 分类，如：[人物交集]、[商业内幕]、[底层逻辑]、[面试真题]。
   - summary 必须是一句引人入胜的导语，引导用户去点击并展开下一组牌堆。
   - next_prompt 是为下一次 API 调用准备的精确提示词。

# Required JSON Schema
{
  "cards": [
    {
      "id": 1,
      "title": "卡片1标题",
      "content": "- 核心观点或事实1\\n- 核心观点或事实2\\n- 核心观点或事实3"
    }
  ],
  "extended_topics": [
    {
      "title": "延伸话题标题",
      "tag": "人物交集",
      "summary": "一句能激发好奇心的简短导语。",
      "next_prompt": "下一次生成新牌堆的精确提示词"
    }
  ]
}`;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.GEMINI_API_KEY;
  const MODEL = env.GEMINI_MODEL || DEFAULT_MODEL;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "请求体必须为 JSON" }, 400);
  }

  const { topic, prompt } = body;

  // ===== relate 模式：多源可切换，柔性输出 =====
  if (body.mode === "relate" || body.mode === "relate_follow") {
    // 后端默认源来自 CF 环境变量 AI_PROVIDER；允许请求级覆盖（body.provider 或 ?provider=）
    // 合法值：dots | bai（deepseek 别名映射到 bai）| openrouter | custom。非法/不传则回退默认。
    let provider = (env.AI_PROVIDER || "dots").toLowerCase();
    const override = (body.provider || (context.request && new URL(context.request.url).searchParams.get("provider")) || "").toLowerCase();
    if (override) {
      const norm = override === "deepseek" ? "bai" : override;
      if (["dots", "bai", "openrouter", "custom"].includes(norm)) provider = norm;
    }
    if (provider === "bai") {
      return await handleRelateBai(body, env);
    }
    if (provider === "openrouter") {
      return await handleRelateOpenRouter(body, env);
    }
    if (provider === "custom") {
      return await handleRelateCustom(body, env);
    }
    return await handleRelateDots(body, env);
  }

  // ===== 非 relate 模式：仅 Gemini =====
  if (!API_KEY) {
    return json({ error: "GEMINI_API_KEY 未配置，请在 Cloudflare 后台 → Settings → Variables 中添加" }, 500);
  }

  let googlePayload;
  if (topic) {
    // 模式 1：生成知识卡片
    googlePayload = {
      contents: [{ parts: [{ text: topic }] }],
      systemInstruction: { parts: [{ text: CARD_SYSTEM }] },
      tools: [{ googleSearch: {} }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    };
  } else if (prompt) {
    // 模式 2：通用调用（enrich-cards 用）
    googlePayload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };
  } else {
    return json({ error: "请提供 topic 或 prompt 字段" }, 400);
  }

  try {
    const url = `${BASE}/${MODEL}:generateContent?key=${API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(googlePayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `Gemini API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }

    const data = await res.json();

    if (body.mode === "relate") {
      // 关联模式：返回 relations（数组或纯文本皆可，带获取时间戳）
      const rawText = (data.candidates[0].content.parts[0].text || "").trim();
      const parsed = parseRelate(rawText);
      // 联网检索到的真实来源（googleSearch 开启时返回 groundingMetadata；无则空数组）
      let sources = [];
      try {
        const gm = data.candidates[0].groundingMetadata;
        if (gm && Array.isArray(gm.groundingChunks)) {
          sources = gm.groundingChunks
            .map(function (c) { return (c.web && c.web.uri) ? { title: c.web.title || c.web.uri, uri: c.web.uri } : null; })
            .filter(Boolean)
            .slice(0, 4);
        }
      } catch (e2) {}
      return json({ relations: parsed.relations, raw: parsed.raw, sources: sources, fetchedAt: new Date().toISOString(), provider: "gemini" });
    } else if (topic) {
      // 卡片模式：直接返回 Gemini 生成的 JSON
      const rawText = data.candidates[0].content.parts[0].text;
      return new Response(rawText, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
        },
      });
    } else {
      // 通用模式：返回完整响应
      const text = data.candidates[0].content.parts[0].text;
      return json({ text });
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestGet(context) {
  const { env } = context;
  const hasKey = !!env.GEMINI_API_KEY;
  return json({
    status: "ok",
    message: "Gemini API 反代已就绪，请使用 POST 请求",
    key_configured: hasKey,
    modes: hasKey ? ["topic (生成卡片)", "prompt (通用调用)", "mode=relate (AI 关联)"] : ["未配置 API Key，请先在 CF 后台设置 GEMINI_API_KEY 环境变量"],
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

// ===== relate 模式解析：优先 JSON 数组，失败则整段当作纯文本讲解 =====
// 期望结构：
//   { "relations": [{type, text}...], "followups": [{id, text}...] }
// followups 为引导式提问，前端渲染为可点击气泡，点了发起 relate_follow 追问。
function parseRelate(rawText) {
  if (!rawText) return { relations: [], raw: "", followups: [] };
  const trimmed = rawText.trim();
  let obj = null;
  try {
    obj = JSON.parse(trimmed);
  } catch (e) {
    // 退化：在文本中查找第一个 { 到最后一个 } 的对象片段（兼容模型包了 markdown）
    const s = trimmed.search(/\{/);
    const end = trimmed.lastIndexOf("}");
    if (s >= 0 && end > s) {
      try { obj = JSON.parse(trimmed.slice(s, end + 1)); } catch (e2) {}
    }
  }
  if (obj && typeof obj === "object") {
    let relations = [];
    let followups = [];
    // 兼容两种形态：整体对象带 relations/followups，或纯数组
    if (Array.isArray(obj)) {
      relations = obj;
    } else {
      if (Array.isArray(obj.relations)) relations = obj.relations;
      if (Array.isArray(obj.followups)) followups = obj.followups;
    }
    const relOut = relations
      .filter(function (x) { return x && (x.text || x.content); })
      .map(function (x) {
        return { type: x.type || "关联", text: String(x.text || x.content || "").trim() };
      })
      .slice(0, 8);
    const folOut = followups
      .filter(function (x) { return x && (x.text || x.question); })
      .map(function (x, i) {
        return { id: String(x.id || ("q" + (i + 1))), text: String(x.text || x.question || "").trim() };
      })
      .slice(0, 5);
    if (relOut.length || folOut.length) {
      return { relations: relOut, raw: "", followups: folOut };
    }
    // 对象里可能有 raw 纯文本讲解
    if (obj.raw) return { relations: [], raw: String(obj.raw).trim(), followups: [] };
  }
  // 纯文本形式（引导式提问 / 关联讲解）：整段返回，前端按段落渲染
  return { relations: [], raw: trimmed, followups: [] };
}

// ===== relate 提示词（所有源共用）：要求同时返回关联点 + 引导式提问 =====
function buildRelateMessages(hook, concept, nodes) {
  const relatePrompt = `你是一个帮人做"即兴表达"的陪练。下面是一张知识卡的话题信息：

【主问题】${hook}
【核心结论】${concept}
【知识树节点】${nodes}

请围绕这个话题，生成"关联内容"——帮练习者在即兴表达时把当前话题连接到更多现象、案例、概念、角度和提问，让讲述既有深度又有广度、不像背稿。

必须严格只输出一个 JSON 对象（不要 markdown 标记、不要解释文字），结构如下：
{
  "relations": [
    { "type": "现象", "text": "..." },
    { "type": "案例", "text": "..." },
    { "type": "概念", "text": "..." },
    { "type": "角度", "text": "..." },
    { "type": "反常识", "text": "..." }
  ],
  "followups": [
    { "id": "q1", "text": "一个能让人当场思考/展开的问题" },
    { "id": "q2", "text": "另一个引导式提问" }
  ]
}

要求：
1. relations 3-6 条，type 从 [现象, 案例, 概念, 角度, 反常识] 中选，text 1-2 句、直白有信息量，必须和当前话题真有关联（延伸/对照/因果/现实映射）。不要空话、不要重复主问题。
2. followups 2-4 个引导式提问——这些是"钩子"，让用户点击后你能围绕它继续深入展开。提问要具体、能引发真实思考或表达。
3. 若 followups 为主，relations 可少给；二者都给最佳。`;
  const systemMsg = "你是即兴表达陪练，输出简洁、有信息量、能直接当谈资。中文回复。";
  return [
    { role: "system", content: systemMsg },
    { role: "user", content: relatePrompt },
  ];
}

// ===== relate_follow 提示词：针对用户点选的某个引导提问，深入展开 =====
function buildFollowMessages(hook, concept, nodes, question) {
  const followPrompt = `你是一个帮人做"即兴表达"的陪练。用户正在练习围绕下面这张知识卡做表达：

【主问题】${hook}
【核心结论】${concept}
【知识树节点】${nodes}

用户刚刚点选了一个引导问题，希望你能围绕它深入展开，帮他把这个点讲透、讲生动：
【用户选的问题】${question}

请生成针对这个问题的"深入关联内容"——可以是一段讲解、几个支撑案例/角度、或进一步的小追问。必须严格只输出一个 JSON 对象（不要 markdown 标记、不要解释文字）：
{
  "relations": [
    { "type": "讲解", "text": "..." },
    { "type": "案例", "text": "..." },
    { "type": "角度", "text": "..." }
  ],
  "followups": [
    { "id": "q1", "text": "基于上面展开，可以再追问的一个问题" }
  ]
}

要求：
1. relations 2-4 条，直接回应那个问题，text 要具体、能当谈资，不要泛泛而谈。
2. followups 1-3 个，基于这次展开继续引导用户往下挖（可空数组表示到这里收住）。
3. 若 relations 更适合用纯文本讲解，也可返回 { "raw": "一段讲解...", "followups": [...] }。`;
  const systemMsg = "你是即兴表达陪练，输出简洁、有信息量、能直接当谈资。中文回复。";
  return [
    { role: "system", content: systemMsg },
    { role: "user", content: followPrompt },
  ];
}

// ===== relate 模式：b.ai 源（OpenAI 兼容 chat/completions，免费模型强制 stream=true）=====
async function handleRelateBai(body, env) {
  const API_KEY = env.BAI_API_KEY;
  if (!API_KEY) {
    return json({ error: "BAI_API_KEY 未配置（AI_PROVIDER=bai 时需要）" }, 500);
  }
  const BAI_MODEL = env.BAI_MODEL || "deepseek-v4-flash";
  const BASE = env.BAI_BASE || BAI_BASE;
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const isFollow = body.mode === "relate_follow";
  const userQ = body.question || "";
  const messages = isFollow
    ? buildFollowMessages(hook, concept, nodes, userQ)
    : buildRelateMessages(hook, concept, nodes);
  const payload = {
    model: BAI_MODEL,
    messages: messages,
    temperature: 0.7,
    stream: true,
  };
  try {
    const url = `${BASE}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `b.ai API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    // 流式读取 SSE，聚合 delta.content（丢弃 reasoning_content 思维链）
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let content = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t || !t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
          if (delta && typeof delta.content === "string") content += delta.content;
        } catch (e3) {}
      }
    }
    const rawText = content.trim();
    if (!rawText) {
      return json({ error: "b.ai 返回空内容（免费模型可能限流，稍后重试或换 BAI_MODEL）" }, 502);
    }
    const parsed = parseRelate(rawText);
    // b.ai 免费模型不支持 grounding，来源恒为空
    return json({ relations: parsed.relations, raw: parsed.raw, followups: parsed.followups || [], sources: [], fetchedAt: new Date().toISOString(), provider: "bai" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ===== relate 模式：dots3 源（小红书自研，OpenAI 兼容 chat/completions，鉴权头为 api-key 而非 Bearer）=====
async function handleRelateDots(body, env) {
  const API_KEY = env.DOTS_API_KEY;
  if (!API_KEY) {
    return json({ error: "DOTS_API_KEY 未配置（AI_PROVIDER=dots 时需要）" }, 500);
  }
  const DOTS_MODEL = env.DOTS_MODEL || "dots3-note-prev";
  const BASE = env.DOTS_BASE || DOTS_BASE;
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const isFollow = body.mode === "relate_follow";
  const userQ = body.question || "";
  const messages = isFollow
    ? buildFollowMessages(hook, concept, nodes, userQ)
    : buildRelateMessages(hook, concept, nodes);
  const payload = {
    model: DOTS_MODEL,
    messages: messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: false,
    chat_template_kwargs: { enable_thinking: false },
  };
  try {
    const url = `${BASE}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": API_KEY,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `dots3 API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    const data = await res.json();
    const rawText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    if (!rawText) {
      return json({ error: "dots3 返回空内容（可能限流，稍后重试或换源）" }, 502);
    }
    const parsed = parseRelate(rawText);
    // dots3 无 grounding，来源恒为空
    return json({ relations: parsed.relations, raw: parsed.raw, followups: parsed.followups || [], sources: [], fetchedAt: new Date().toISOString(), provider: "dots" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ===== relate 模式：custom 源（用户在前端填自己的 OpenAI 兼容接口，透传 key/base/model）=====
// 安全边界：
//   - 仅允许 https 开头的 baseUrl，且必须是合法 URL，防 SSRF/内网探测；
//   - apiKey 仅用于本次请求，不落库、不回显；
//   - 走 OpenAI 兼容 /chat/completions，Bearer 鉴权；支持流式聚合。
async function handleRelateCustom(body, env) {
  const custom = body.custom || {};
  const BASE = (custom.baseUrl || "").trim();
  const MODEL = (custom.model || "").trim();
  const API_KEY = (custom.apiKey || "").trim();
  if (!BASE || !MODEL || !API_KEY) {
    return json({ error: "自定义模型需要接口地址、模型名、API Key 三项齐全" }, 400);
  }
  // SSRF 防护：仅 https，且解析后 host 不能是内网地址
  let parsedUrl;
  try {
    parsedUrl = new URL(BASE);
    if (parsedUrl.protocol !== "https:") {
      return json({ error: "接口地址仅支持 https" }, 400);
    }
    const host = parsedUrl.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.16.") || host.startsWith("172.17.") || host.startsWith("172.18.") || host.startsWith("172.19.") || host.startsWith("172.2") || host.startsWith("172.3") || host.endsWith(".internal") || host.endsWith(".local")) {
      return json({ error: "接口地址不允许指向本地或内网" }, 400);
    }
  } catch (e) {
    return json({ error: "接口地址格式不正确" }, 400);
  }
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const isFollow = body.mode === "relate_follow";
  const userQ = body.question || "";
  const messages = isFollow
    ? buildFollowMessages(hook, concept, nodes, userQ)
    : buildRelateMessages(hook, concept, nodes);
  const url = `${BASE.replace(/\/+$/, "")}/chat/completions`;
    const payload = {
    model: MODEL,
    messages: messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: true,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `自定义接口 ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    // 兼容流式与非流式：流式按 SSE 聚合；非流式直接取 message.content
    const ct = res.headers.get("content-type") || "";
    let rawText = "";
    if (res.body && ct.indexOf("text/event-stream") >= 0) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t || !t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const chunk = JSON.parse(data);
            const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
            if (delta && typeof delta.content === "string") rawText += delta.content;
          } catch (e3) {}
        }
      }
    } else {
      const data = await res.json();
      rawText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    }
    if (!rawText) {
      return json({ error: "自定义接口返回空内容（检查模型名/Key，或该接口不支持流式）" }, 502);
    }
    const parsed = parseRelate(rawText);
    return json({ relations: parsed.relations, raw: parsed.raw, followups: parsed.followups || [], sources: [], fetchedAt: new Date().toISOString(), provider: "custom" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ===== relate 模式：openrouter 源（OpenAI 兼容，Bearer 鉴权，支持流式）=====
async function handleRelateOpenRouter(body, env) {
  const API_KEY = env.OPENROUTER_API_KEY;
  if (!API_KEY) {
    return json({ error: "OPENROUTER_API_KEY 未配置（AI_PROVIDER=openrouter 时需要）" }, 500);
  }
  const OR_MODEL = env.OPENROUTER_MODEL || "stealth/ox-alpha";
  const BASE = env.OPENROUTER_BASE || OPENROUTER_BASE;
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const isFollow = body.mode === "relate_follow";
  const userQ = body.question || "";
  const messages = isFollow
    ? buildFollowMessages(hook, concept, nodes, userQ)
    : buildRelateMessages(hook, concept, nodes);
  const url = `${BASE.replace(/\/+$/, "")}/chat/completions`;
  const payload = {
    model: OR_MODEL,
    messages: messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: true,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer": "https://exam.955827.xyz",
        "X-Title": "RCJ Learn",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `OpenRouter API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    // 流式读取 SSE，聚合 delta.content（ox-alpha 为 reasoning 模型，会吐 reasoning 但本场景只取 content）
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let content = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t || !t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
          if (delta && typeof delta.content === "string") content += delta.content;
        } catch (e3) {}
      }
    }
    const rawText = content.trim();
    if (!rawText) {
      return json({ error: "OpenRouter 返回空内容（模型可能限流或正在思考，稍后重试）" }, 502);
    }
    const parsed = parseRelate(rawText);
    return json({ relations: parsed.relations, raw: parsed.raw, followups: parsed.followups || [], sources: [], fetchedAt: new Date().toISOString(), provider: "openrouter" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}