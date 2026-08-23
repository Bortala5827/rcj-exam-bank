import { spawn } from "node:child_process";

const child = spawn(
  "npx",
  ["--yes", "@playwright/mcp@latest", "--extension"],
  {
    shell: true,
    env: { ...process.env, PLAYWRIGHT_MCP_EXTENSION_TOKEN: "LaHNmHtCUz0aM2-LXLJtZHaHLkQgDeTT8tSQpSwnNPM" },
  }
);

let buf = "";
let step = 0;
const pending = new Map();
let idc = 0;

child.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    handle(msg);
  }
});

function handle(msg) {
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
}

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++idc;
    pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(method + " 超时")); } }, 60000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  console.log("[probe] initialize...");
  await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "probe", version: "1.0.0" },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  console.log("[probe] tools/list...");
  const t = await call("tools/list");
  const names = (t.tools || []).map((x) => x.name);
  console.log("[probe] tools:", names.length, "个");
  if (!names.includes("browser_navigate")) throw new Error("缺 browser_navigate 工具");

  console.log("[probe] browser_navigate -> about:blank（触发扩展审批弹窗）...");
  const r = await call("tools/call", {
    name: "browser_navigate",
    arguments: { url: "https://example.com" },
  });
  console.log("[probe] 导航结果:", JSON.stringify(r).slice(0, 400));
  console.log("[probe] RESULT: 扩展连接成功 ✅");
} catch (e) {
  console.log("[probe] RESULT: 失败 ❌ ->", e.message);
} finally {
  child.stdin.end();
  child.kill();
  process.exit(0);
}