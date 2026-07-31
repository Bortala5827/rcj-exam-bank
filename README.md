# rcj-exam-bank · 综合公职考试「考试学习中心」

> RCJ 招考生态三大仓库之一，定位**综合公职考试**（国考 / 省考 / 事业编 / 教师招聘 / 军队文职）。
> RCJ 整体定位 = **考试学习平台（RCJ Exam Hub）**：把公开考试资料变成更高效的学习工具；本站是其中的"考试学习中心"，**不卖真题**。
> 同源仓库：`aux-police-exam`（辅警）、`xf-firefighter-exam`（消防）。
> 品牌/商业定位见 `RCJ-品牌定位与商业模型-v1.md`。

## 这是什么

一套**复用同一网站模板、按考试类型分实例**的静态「考试学习中心」。每个考试类型是一个实例，资料多元（真题 / 公告 / 考纲 / 法律法规 / 高频考点 / 面试 / 体测），不止真题：

```
实例 = config.js（品牌/文案/模块开关） + data-written.json（笔试题库） + 生成的 index.html
（面试题库 data-interview.json 不入本仓库，后期由独立面试仓库承载）
```

新增考试 = 复制模板 + 填一份 config + 一份题库，**不重开发**。模板与数据完全解耦，由 `rcj-exam-builder` 技能产出。

## 目录结构

```
rcj-exam-bank/
├── README.md
├── _template/                  # 共用模板与配置样例
│   └── template-config.example.json
├── _migration/                 # 旧仓库迁入说明
│   └── civil-service-interview.md
├── guokao/                     # 国考
│   └── bishi/                  # 笔试专区
│       ├── xingce/             # 行测（真题PDF等）
│       └── shenlun/            # 申论
├── shengkao/                   # 省考（含各省略数据或子目录）
│   └── bishi/                  # 笔试专区（行测/申论）
├── shiye/                      # 事业编
├── jiaoshi/                    # 教师招聘
└── wenwen/                     # 军队文职
```

分类规范（重要）：
- **笔试（bishi）必须按科目分**：`xingce/`（行测）、`shenlun/`（申论）各自独立目录，不得混放。
- **面试不进本仓库**：后期单独建仓库承载，本仓库只收笔试及公告/考纲/法律法规等书面资料。
- 每个考试类型目录另放：`config.js`、`data-written.json`、构建出的 `index.html`（面试相关 `data-interview.json` 留待面试独立仓库）。

## 范围与节奏（先广东，后全国）

- **第一步只做广东**：广东省考、广东事业单位、广州、深圳（聚焦、跑通闭环）。
- 模板成熟后再复制：江苏 / 浙江 / 福建。
- 这与 `GitHub仓库规划-v1`、`RCJ-品牌定位与商业模型-v1` 一致。

## 商业模式（免费资料 + 收费工具，不卖 PDF）

- **免费引流**：真题 / 公告 / PDF / 在线阅读。
- **收费变现**：HTML 离线版 / Anki / AI 讲解 / AI 刷题 / AI 面试 / 知识库（传不走的服务/结果，抗白嫖）。
- 标杆：`aux-police-exam` 深圳辅警已验证"公开资料做成好用的形式就能卖出去"。

## 如何新增一个考试类型

1. 复制 `_template/template-config.example.json` 到新目录，改名 `template-config.json`，改 `siteTitle/subtitle/datasets` 等。
2. 准备笔试题库 `data-written.json`（用 `rcj-exam-builder` 的 `ingest.py` 从 CSV/PDF/Word 转）；面试题库 `data-interview.json` 留待面试独立仓库。
3. `build_data.py` 生成 `data-*.js` + `config.js` + `VERSION.json`。
4. `viewer.html` → `index.html` 作为入口。
5. push → Cloudflare 自动部署，路径即 `/<目录名>/`。

详见技能 `rcj-exam-builder`（本机 `~/.workbuddy/skills/rcj-exam-builder`）。

## 与 civil-service-interview 的关系

原 `civil-service-interview` 的面试内容**不再并入本仓库**：按最新规划，面试（含 `data-interview.json` 面试题库）**后期单独建仓库**承载，本仓库只聚焦笔试及书面资料。旧仓库归档说明见 `_migration/civil-service-interview.md`。

## 部署

Cloudflare Pages 连本仓库，构建设置 None，输出目录 `/`。子目录即各考试类型在线地址。
