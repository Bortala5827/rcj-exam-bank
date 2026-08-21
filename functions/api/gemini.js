/* Gemini API 反代（Cloudflare Pages Function）
 * 部署后访问: https://exam.955827.xyz/api/gemini
 *
 * 两种模式：
 *   POST { topic: "主题" }  → 生成知识卡片（系统提示词 + 联网搜索）
 *   POST { prompt: "指令" }  → 通用调用（给 enrich-cards 脚本用）
 *
 * 安全：
 *   API Key 在 Cloudflare 后台 → Settings → Variables 设为 GEMINI_API_KEY（加密存储）
 *   代码里不写 Key，不走公开仓库
 */

const MODEL = "gemini-2.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

  if (!API_KEY) {
    return json({ error: "GEMINI_API_KEY 未配置，请在 Cloudflare 后台 → Settings → Variables 中添加" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "请求体必须为 JSON" }, 400);
  }

  const { topic, prompt } = body;

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

    if (topic) {
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
    modes: hasKey ? ["topic (生成卡片)", "prompt (通用调用)"] : ["未配置 API Key，请先在 CF 后台设置 GEMINI_API_KEY 环境变量"],
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