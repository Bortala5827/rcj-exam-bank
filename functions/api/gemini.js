/* Gemini / OpenRouter 双源反代（Cloudflare Pages Function）
 * 部署后访问: https://exam.955827.xyz/api/gemini
 *
 * 模式：
 *   POST { topic: "主题" }                 → 生成知识卡片（仅 Gemini，含联网搜索）
 *   POST { prompt: "指令" }                 → 通用调用（仅 Gemini）
 *   POST { mode: "relate", hook, concept, nodes } → AI 关联（三源可切换）
 *
 * 安全：
 *   API Key 在 Cloudflare 后台 → Settings → Variables 加密存储，代码里不写 Key。
 *
 * 环境变量：
 *   GEMINI_API_KEY        Gemini key（topic/prompt 模式必填）
 *   GEMINI_MODEL          默认 gemini-3.6-flash，可覆盖
 *   AI_PROVIDER           relate 模式走哪个源：gemini（默认）| openrouter | bai
 *   OPENROUTER_API_KEY    OpenRouter key（AI_PROVIDER=openrouter 时必填）
 *   OPENROUTER_MODEL      OpenRouter 模型 id，如 nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
 *   BAI_API_KEY           b.ai key（AI_PROVIDER=bai 时必填）
 *   BAI_MODEL             b.ai 模型 id，默认 deepseek-v4-flash（免费）；也可 hy3
 *   BAI_BASE              b.ai API base，默认 https://api.b.ai/v1
 *   注：b.ai 免费模型强制 stream=true，本 handler 按流式读取 SSE 后聚合。
 */

// 模型名：新用户已无法使用 gemini-2.5-flash（404 提示改用 3.6-flash）。
// 可在 CF 后台 Settings → Variables 用 GEMINI_MODEL 覆盖，不配则走默认。
const DEFAULT_MODEL = "gemini-3.6-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const OR_BASE = "https://openrouter.ai/api/v1";
const BAI_BASE = "https://api.b.ai/v1";

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

  // ===== relate 模式：双源可切换，柔性输出 =====
  if (body.mode === "relate") {
    const provider = (env.AI_PROVIDER || "gemini").toLowerCase();
    if (provider === "openrouter") {
      return await handleRelateOpenRouter(body, env);
    }
    if (provider === "bai") {
      return await handleRelateBai(body, env);
    }
    return await handleRelateGemini(body, env);
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
function parseRelate(rawText) {
  if (!rawText) return { relations: [], raw: "" };
  const trimmed = rawText.trim();
  // 尝试 JSON 数组
  let arr = null;
  try {
    arr = JSON.parse(trimmed);
  } catch (e) {
    // 退化：在文本中查找第一个 [ 到最后一个 ] 的数组片段
    const s = trimmed.search(/\[\s*\{/);
    const end = trimmed.lastIndexOf("]");
    if (s >= 0 && end > s) {
      try { arr = JSON.parse(trimmed.slice(s, end + 1)); } catch (e2) {}
    }
  }
  if (Array.isArray(arr)) {
    const relations = arr
      .filter(function (x) { return x && (x.text || x.content); })
      .map(function (x) {
        return { type: x.type || "关联", text: String(x.text || x.content || "").trim() };
      })
      .slice(0, 8);
    if (relations.length) return { relations: relations, raw: "" };
  }
  // 纯文本形式（引导式提问 / 关联讲解）：整段返回，前端按段落渲染
  return { relations: [], raw: trimmed };
}

// ===== relate 模式：Gemini 源 =====
async function handleRelateGemini(body, env) {
  const API_KEY = env.GEMINI_API_KEY;
  if (!API_KEY) {
    return json({ error: "GEMINI_API_KEY 未配置（AI_PROVIDER=gemini 时需要）" }, 500);
  }
  const MODEL = env.GEMINI_MODEL || DEFAULT_MODEL;
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const relatePrompt = `你是一个帮人做"即兴表达"的陪练。下面是一张知识卡的话题信息：

【主问题】${hook}
【核心结论】${concept}
【知识树节点】${nodes}

请围绕这个话题，生成一组"关联内容"——帮练习者在即兴表达时把当前话题连接到更多现象、案例、概念、角度和提问，让讲述既有深度又有广度、不像背稿。

具体形式由你判断，选最合适的一种（可混合）：
A. 关联点列表：3-6 条，每条带 type（从 [现象, 案例, 概念, 角度, 反常识] 中选其一）和 text（1-2 句，直白有信息量）。
B. 引导式提问：3-5 个能让人当场思考/展开的问题。
C. 关联答案/讲解：一段 2-4 句的延伸讲解，把话题接到某个现实或底层逻辑。

要求：
1. 必须和当前话题真有关联（延伸 / 对照 / 因果 / 现实映射），不是泛泛而谈。
2. 不要空话，不要重复主问题本身。
3. 若引用当下真实案例或数据，请确保真实可靠。

优先用 JSON 数组输出（不要 markdown 标记）：
[
  { "type": "现象", "text": "..." },
  { "type": "提问", "text": "..." },
  { "type": "讲解", "text": "..." }
]
若以 B/C 为主，也可直接输出带小标题的纯文本。`;
  const payload = {
    contents: [{ parts: [{ text: relatePrompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
  };
  try {
    const url = `${GEMINI_BASE}/${MODEL}:generateContent?key=${API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `Gemini API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    const data = await res.json();
    const rawText = (data.candidates[0].content.parts[0].text || "").trim();
    const parsed = parseRelate(rawText);
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
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ===== relate 模式：OpenRouter 源（OpenAI 兼容 chat/completions，免费模型不支持 grounding）=====
async function handleRelateOpenRouter(body, env) {
  const API_KEY = env.OPENROUTER_API_KEY;
  if (!API_KEY) {
    return json({ error: "OPENROUTER_API_KEY 未配置（AI_PROVIDER=openrouter 时需要）" }, 500);
  }
  const OR_MODEL = env.OPENROUTER_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
  const hook = body.hook || "";
  const concept = body.concept || "";
  const nodes = Array.isArray(body.nodes) ? body.nodes.join("、") : (body.nodes || "");
  const relatePrompt = `你是一个帮人做"即兴表达"的陪练。下面是一张知识卡的话题信息：

【主问题】${hook}
【核心结论】${concept}
【知识树节点】${nodes}

请围绕这个话题，生成一组"关联内容"——帮练习者在即兴表达时把当前话题连接到更多现象、案例、概念、角度和提问，让讲述既有深度又有广度、不像背稿。

具体形式由你判断，选最合适的一种（可混合）：
A. 关联点列表：3-6 条，每条带 type（从 [现象, 案例, 概念, 角度, 反常识] 中选其一）和 text（1-2 句，直白有信息量）。
B. 引导式提问：3-5 个能让人当场思考/展开的问题。
C. 关联答案/讲解：一段 2-4 句的延伸讲解，把话题接到某个现实或底层逻辑。

要求：
1. 必须和当前话题真有关联（延伸 / 对照 / 因果 / 现实映射），不是泛泛而谈。
2. 不要空话，不要重复主问题本身。

优先用 JSON 数组输出（不要 markdown 标记）：
[
  { "type": "现象", "text": "..." },
  { "type": "提问", "text": "..." },
  { "type": "讲解", "text": "..." }
]
若以 B/C 为主，也可直接输出带小标题的纯文本。`;
  const systemMsg = "你是即兴表达陪练，输出简洁、有信息量、能直接当谈资。中文回复。";
  const payload = {
    model: OR_MODEL,
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: relatePrompt },
    ],
    temperature: 0.7,
  };
  try {
    const url = `${OR_BASE}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer": "https://exam.955827.xyz",
        "X-Title": "RCJ Learn AI Relate",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `OpenRouter API ${res.status}: ${errText.slice(0, 300)}` }, res.status);
    }
    const data = await res.json();
    const rawText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    const parsed = parseRelate(rawText);
    // OpenRouter 免费模型不支持 grounding，来源恒为空
    return json({ relations: parsed.relations, raw: parsed.raw, sources: [], fetchedAt: new Date().toISOString(), provider: "openrouter" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
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
  const relatePrompt = `你是一个帮人做"即兴表达"的陪练。下面是一张知识卡的话题信息：

【主问题】${hook}
【核心结论】${concept}
【知识树节点】${nodes}

请围绕这个话题，生成一组"关联内容"——帮练习者在即兴表达时把当前话题连接到更多现象、案例、概念、角度和提问，让讲述既有深度又有广度、不像背稿。

具体形式由你判断，选最合适的一种（可混合）：
A. 关联点列表：3-6 条，每条带 type（从 [现象, 案例, 概念, 角度, 反常识] 中选其一）和 text（1-2 句，直白有信息量）。
B. 引导式提问：3-5 个能让人当场思考/展开的问题。
C. 关联答案/讲解：一段 2-4 句的延伸讲解，把话题接到某个现实或底层逻辑。

要求：
1. 必须和当前话题真有关联（延伸 / 对照 / 因果 / 现实映射），不是泛泛而谈。
2. 不要空话，不要重复主问题本身。

优先用 JSON 数组输出（不要 markdown 标记）：
[
  { "type": "现象", "text": "..." },
  { "type": "提问", "text": "..." },
  { "type": "讲解", "text": "..." }
]
若以 B/C 为主，也可直接输出带小标题的纯文本。`;
  const systemMsg = "你是即兴表达陪练，输出简洁、有信息量、能直接当谈资。中文回复。";
  const payload = {
    model: BAI_MODEL,
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: relatePrompt },
    ],
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
    return json({ relations: parsed.relations, raw: parsed.raw, sources: [], fetchedAt: new Date().toISOString(), provider: "bai" });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}