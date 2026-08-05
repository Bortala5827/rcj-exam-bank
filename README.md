# rcj-exam-bank · 综合公职考试学习中心（RCJ Exam Hub）

[![在线演示](https://img.shields.io/badge/在线演示-exam.rcj9527.dpdns.org-blue?style=flat-square)](https://exam.rcj9527.dpdns.org)

> RCJ 招考生态的主站，定位**综合公职考试**（国考 / 省考 / 事业编 / 教师 / 文职 的资料聚合）。
> 本站是 **RCJ Exam Hub**——把公开考试资料，变成更高效的学习工具。
> 同源仓库：`aux-police-exam`（辅警站）、`xf-firefighter-exam`（消防站）、`rcj-hub`（RCJ 品牌枢纽页 / 个人主页，域 `955827.xyz`）。
> 商业 / 品牌定位见 `RCJ-品牌定位与商业模型-v1.md`。

## 站点是什么

一个**纯静态**的考试资料站，Cloudflare Pages 托管，无后端、无构建步骤：

- **主站首页 `index.html`**：考试分类导航 + 数据背书条 + 服务介绍 + 友情链接 + footer（品牌胶囊 / 本站运行时长 / 访客计数）。
- **真题 → 公开真题库（外站）**：国考 / 省考 / 事业单位的历年笔试真题（行测 / 申论 / 公基 / 职测 / 综应 / 面试），全部指向公开真题库 [`gwy.gkzhenti.cn`](https://gwy.gkzhenti.cn/)（外站，覆盖比自建 PDF 全得多）。本仓库**不再自建真题 PDF 库**，原 `guokao/`、`shengkao/` 列表页已改为跳转到公开真题库的引导页。
- **AI 刷题库（上架中）**：正在打造专属刷题系统，行测 / 申论 / 面试真题融入 **AI 调用分析**，定位薄弱点、给出提升建议。该能力未来在 RCJ 自有产品站 [`exam.955827.xyz`](https://955827.xyz/) 承载，首页右侧「AI 刷真题 · AI 调用分析 · 上架中」面板是其预告位。
- **教学专区 `tutorials/`**：用 WorkBuddy / Trae / Qoder 等国产 AI 桌面工具把想法上架成网站；Cloudflare Pages 部署、GitHub 基础等教程。
- **私人定制演示 `demo/`**：RCJ 付费定制交付的效果橱窗（以深圳辅警面试三件套为例，不暴露完整题库 / AI key）。

设计原则：**免费真题引流（外链）→ 付费工具变现**（HTML 离线版 / Anki / AI 点评，传不走的服务与结果，抗白嫖）。

## 目录结构

```
rcj-exam-bank/
├── README.md
├── index.html                  # 主站首页（RCJ Exam Hub）
├── assets/
│   ├── eagle.jpg               # 品牌 logo（白头海雕）
│   ├── list.20260731.js        # 共享渲染器（真题清单 / 卡片 / 大小徽章 / 大文件弹层）
│   └── list.20260731.css       # 共享样式
├── guokao/                     # 国考：已改为「跳转到公开真题库」引导页
│   └── index.html
├── shengkao/                   # 省考：已改为「跳转到公开真题库」引导页
│   ├── index.html
│   └── guangdong/              # 广东专区：已整合进省考，现为跳转提示页
├── shiye/  jiaoshi/  wenwen/   # 事业编 / 教师 / 文职 —— 占位骨架（规划中）；
│                               #   首页仅"事业编 → 事业单位"露出外链至 gwy.gkzhenti.cn
├── tutorials/                  # 建站 / 工具教学（已上线）
├── demo/                       # 付费定制效果演示页（橱窗）
├── _template/                  # 新考试页模板
├── _migration/                 # 旧仓库迁入说明
├── tools/                      # 历史脚本：gen_pdfs.py 等（真题 PDF 下架后保留备查）
├── _headers                    # 对 *.html 设 no-cache
└── 新增考试页指南.md            # 加题库 / 建新页的详细防错指南（实战踩坑固化）
```

> **真题 PDF 已下架说明**：原国考 / 省考真题 PDF（`guokao/bishi/`、`shengkao/bishi/`）虽仍存于物理存储（R2），但 `pdf-manifest.js` 已清空、列表页已改为外链引导，**前端无任何真题入口**。后续如需恢复自建题库，参考 `新增考试页指南.md`。

## 首页模块状态

| 模块 | 名称 | 状态 |
|------|------|------|
| 公考真题入口 | 国考 · 省考 · 事业编 → `gwy.gkzhenti.cn` | ✅ 外站直达 |
| AI 刷题库 | 行测 / 申论 / 面试 AI 调用分析 | 🚧 上架中（预告位） |
| 教学专区 | 建站 / 工具教学 `tutorials/` | ✅ 已上线 |
| 私人定制演示 | RCJ 付费定制交付样例 `demo/` | ✅ 已上线 |
| 友情链接 | 公开真题库 / kaogong-materials（均外链） | ✅ 已上线 |

> 辅警、消防**不在本仓库**，而是独立站（`aux-police-exam` / `xf-firefighter-exam`），通过主站 footer 胶囊（辅警 / 消防 / 公开真题库）互链。面试同样由这些独立站承载，本仓库只做笔试及书面资料的聚合与引流。

## 部署

Cloudflare Pages 连本仓库 `main`，构建设置 **None**，输出目录 `/`。子目录即各考试类型在线地址：

- 主站：`https://exam.rcj9527.dpdns.org/`（自定义域，亦 `exam.955827.xyz` / `rcj-exam-bank.pages.dev`）
- 国考：`/guokao/`　省考：`/shengkao/`（均为跳转公开真题库的引导页）

`git push` 即自动部署。`_headers` 已对 `*.html` 设 `no-cache`；静态资源走 CDN 缓存。

## 技术约束（踩过的坑）

- **Cloudflare Pages 单文件硬上限 25MB**：超限会让整个部署上传失败。超大 PDF 用 PyMuPDF 降 DPI+JPEG 压到 25MB 内（文件名不变），或走网盘（夸克）双轨（见指南第八节）。
- **缓存版本号**：共享脚本用 `?v=N` 做 cache-busting，改脚本后必须 +1，否则用户拿到旧缓存（用户侧 `Ctrl+F5` 硬刷）。
- **CF clean-URL 308 重定向**：`/xxx/index.html` 会 308 到 `/xxx/`，线上核查务必用目录形式 `curl /xxx/`，否则误判"页面空 / 没更新"。
- **GitHub DNS 劫持绕过**：本机 `github.com` 常被 DNS 劫持到假 IP，导致 `git push` 失败。可用 UDP-DNS 本地代理（`github-dns-bypass` skill）绕开，或先确认 Clash 代理是否启动。

## 商业模式

- **免费引流**：真题经公开真题库（外链）直达、公告 / 考纲、教学教程。
- **收费变现**：HTML 离线版 / Anki 卡包 / AI 讲解 / AI 面试点评（传不走的服务与结果，抗白嫖）。
- 标杆：`aux-police-exam` 深圳辅警已验证"公开资料做成好用的形式就能卖出去"。
