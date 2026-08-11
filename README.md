# RCJ Exam Hub · 综合公职考试学习中心

RCJ 招考生态主站，定位**综合公职考试**（国考 / 省考 / 事业编 / 教师 / 文职的资料聚合）。把公开考试资料，变成更高效的学习工具。

- **演示**：https://exam.955827.xyz（备用：https://exam.rcj9527.dpdns.org）
- **仓库**：`github.com/Bortala5827/rcj-exam-bank`

## 站点是什么

纯静态、零后端、无构建步骤的考试资料站（Cloudflare Pages）：

- **真题**：国考 / 省考 / 事业编 → 外链公开真题库 [`gwy.gkzhenti.cn`](https://gwy.gkzhenti.cn/)（不自建 PDF 库）
- **教学专区 `tutorials/`**：国产 AI 工具建站 / Cloudflare Pages / GitHub 基础 + [国内大模型免费 API 教程](tutorials/api-key.html)
- **付费定制演示 `demo/`**：RCJ 交付效果橱窗
- **AI 刷真题分析**：规划中（首页灰色预告位）

设计原则：**免费真题引流（外链）→ 付费工具变现**（离线版 / Anki / AI 点评，传不走的服务与结果，抗白嫖）。

## 部署

Cloudflare Pages 连 `main`，构建设置 None，输出 `/`。`git push` 即上线。

## 🌐 RCJ 产品矩阵

RCJ 产品生态共三类：

**① 品牌枢纽（个人主页 / Vibe Coding 展示）**

| 产品 | 站点 | 仓库 |
| --- | --- | --- |
| RCJ Hub · 品牌枢纽 / 个人主页 | https://955827.xyz | rcj-hub |

**② RCJ Exam Hub（公职考试题库，含辅警 / 消防）**

| 产品 | 站点 | 仓库 |
| --- | --- | --- |
| RCJ Exam Hub · 综合公职真题 | https://exam.955827.xyz | rcj-exam-bank |
| 辅警题库 · 多城市刷题 | https://fj.955827.xyz | aux-police-exam |
| 消防员题库 | https://xf.955827.xyz | xf-firefighter-exam |

**③ Speak Series（开口表达系列）**

| 产品 | 站点 | 仓库 |
| --- | --- | --- |
| SoloSpeak · 独声 | https://955827.xyz/solospeak | solospeak |
| LetOut · 大声说 | https://955827.xyz/letout | letout |
| FaceTalk · 面试搭子 | https://ms.955827.xyz | facetalk |

> 备用域名：各站 `*.rcj9527.dpdns.org`（`.xyz` 不可达时回退）。
