# rcj-exam-bank · 综合公职考试真题库（RCJ Exam Hub）

[![在线演示](https://img.shields.io/badge/在线演示-exam.rcj9527.dpdns.org-blue?style=flat-square)](https://exam.rcj9527.dpdns.org)

> RCJ 招考生态的主站，定位**综合公职考试**（国考 / 省考 / 事业编 / 教师 / 文职 的资料聚合）。
> 本站是 **RCJ Exam Hub**——把公开考试真题做成"在线看 + 下载"的静态学习中心，**不卖真题 PDF**。
> 同源仓库：`aux-police-exam`（辅警站）、`xf-firefighter-exam`（消防站）。
> 商业 / 品牌定位见 `RCJ-品牌定位与商业模型-v1.md`。

## 站点是什么

一个**纯静态**的考试资料站，Cloudflare Pages 托管，无后端、无构建步骤：

- **主站首页 `index.html`**：考试分类导航 + 数据背书条 + 服务介绍 + 友情链接 + footer（品牌胶囊 / 本站运行时长 / 访客计数）。
- **每个考试类型是独立目录**（`guokao/`、`shengkao/` …），各自 `index.html` 调用**同一套共享渲染器**渲染真题清单。
- **真题以 PDF 存放**：放在 `<考试>/bishi/<科目>/`，由脚本扫描生成 `pdf-manifest.js`，渲染器读取后生成"在线查看 / 下载"卡片（带文件大小徽章，大文件弹层提示建议下载）。

设计原则：**免费真题引流 → 付费工具变现**（HTML 离线版 / Anki / AI 点评，传不走的服务与结果，抗白嫖）。

## 目录结构

```
rcj-exam-bank/
├── README.md
├── index.html                  # 主站首页（RCJ Exam Hub）
├── assets/
│   ├── eagle.jpg               # 品牌 logo（白头海雕）
│   ├── list.20260731.js        # 共享渲染器（真题清单 / 卡片 / 大小徽章 / 大文件弹层）
│   └── list.20260731.css       # 共享样式
├── guokao/                     # 国考（已上线 28 套）
│   ├── index.html
│   ├── assets/pdf-manifest.js  # 真题清单（含 size 字段）
│   └── bishi/{xingce,shenlun}/ # 行测 / 申论 PDF
├── shengkao/                   # 省考（已上线 29 套，原"广东省考"已并入）
│   ├── index.html
│   ├── assets/pdf-manifest.js
│   ├── bishi/{xingce,shenlun}/
│   └── guangdong/              # 广东专区（已整合进省考，现为"已整合"提示页）
├── shiye/  jiaoshi/  wenwen/   # 事业编 / 教师 / 文职 —— 占位骨架（规划中）；
│                               #   首页仅"事业编 → 事业单位"露出外链至 gwy.gkzhenti.cn
├── demo/                       # 付费定制效果演示页（橱窗，不暴露完整题库 / AI key）
├── _template/                  # 新考试页模板（index.html + pdf-manifest.js 样例）
├── _migration/                 # 旧仓库迁入说明
├── tools/
│   ├── gen_pdfs.py             # 扫描 bishi/ 生成 pdf-manifest.js（自动带 size 字段）
│   ├── clean_shenlun_watermark.py  # 申论扫描件水印白色矩形遮盖
│   └── github-action-sync-pdfs.yml # 自动同步 PDF 的 GitHub Action
├── _headers                    # 对 *.html 设 no-cache
└── 新增考试页指南.md            # 加题库 / 建新页的详细防错指南（实战踩坑固化）
```

## 已上线的考试类型

| 目录 | 名称 | 状态 |
|------|------|------|
| `guokao/` | 国考 | ✅ 28 套（行测 / 申论） |
| `shengkao/` | 省考 | ✅ 29 套（行测 / 申论，原"广东省考"已并入） |
| `shiye/` `jiaoshi/` `wenwen/` | 事业编 / 教师 / 文职 | 🚧 占位骨架；首页仅"事业编 → 事业单位"露出外链至 `gwy.gkzhenti.cn` |

> 辅警、消防**不在本仓库**，而是独立站（`aux-police-exam` / `xf-firefighter-exam`），通过主站 footer 胶囊（辅警 / 消防 / 公考真题库）互链。面试同样由这些独立站承载，本仓库只收笔试及书面资料。

## 加真题 / 新建考试页

详见 **`新增考试页指南.md`**（照做即可避免白屏 / 部署失败）。要点：

1. 复制 `_template/` 到新目录，改 `index.html` 里的 `title` / `subtitle` / `subjectOrder`。
2. 把真题 PDF 按科目放进 `<考试>/bishi/<科目>/`（文件名用**全角配对括号 `（）`**）。
3. 跑 `python tools/gen_pdfs.py --exam <考试>` 生成 `pdf-manifest.js`（自动带 `size` 字段）。
4. 共享渲染器 `assets/list.20260731.{js,css}` 改版后，所有页的 `?v=数字` 要 **+1** 强制刷新缓存（用户侧 `Ctrl+F5` 硬刷）。

## 技术约束（踩过的坑）

- **Cloudflare Pages 单文件硬上限 25MB**：超限会让整个部署上传失败。超大 PDF 用 PyMuPDF 降 DPI+JPEG 压到 25MB 内（文件名不变），或走网盘（夸克）双轨（见指南第八节）。
- **缓存版本号**：共享脚本用 `?v=N` 做 cache-busting，改脚本后必须 +1，否则用户拿到旧缓存。
- **CF clean-URL 308 重定向**：`/xxx/index.html` 会 308 到 `/xxx/`，线上核查务必用目录形式 `curl /xxx/`，否则误判"页面空 / 没更新"。
- **申论水印**：扫描件水印 baked 在图里，用 `clean_shenlun_watermark.py` 白色矩形遮盖。

## 部署

Cloudflare Pages 连本仓库 `main`，构建设置 **None**，输出目录 `/`。子目录即各考试类型在线地址：

- 主站：`https://exam.rcj9527.dpdns.org/`（自定义域，亦 `rcj-exam-bank.pages.dev`）
- 国考：`/guokao/`　省考：`/shengkao/`

`git push` 即自动部署。`_headers` 已对 `*.html` 设 `no-cache`；PDF 等静态资源走 CDN 缓存。

## 商业模式

- **免费引流**：真题 PDF 在线看 / 下载、公告 / 考纲。
- **收费变现**：HTML 离线版 / Anki 卡包 / AI 讲解 / AI 面试点评（传不走的服务与结果，抗白嫖）。
- 标杆：`aux-police-exam` 深圳辅警已验证"公开资料做成好用的形式就能卖出去"。
