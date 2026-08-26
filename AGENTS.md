# RCJ Exam Hub · 仓库规则

综合公职考试学习中心，纯静态 CF Pages。含辅警/消防题库、Learn 知识卡、结构化面试。

## 不要做

- 不加登录/账号体系
- 不把用户答题记录上传云端
- 不在首页放超过 6 个链接
- 不用 `?v=` 做缓存版本号（CF 忽略），改文件名

## 关键路径

- `index.html` — 首页
- `learn/` — 知识卡模块（cards.js 数据 + learn.js 逻辑）
- `fj/` — 辅警题库
- `xf/` — 消防员题库
- `structured.html` — 结构化面试练习
- `functions/api/gemini.js` — AI 多源反代（dots/bai/groq/custom，国内默认 dots）

## 数据约定

- 题库数据存本地 IndexedDB，不迁 D1
- AI 关联源走 `/api/gemini`，国内用户默认 dots
- Learn 卡片数据在 `learn/cards.js`，加卡片注意 id 唯一、tags 在 30 个主题内

## 推送前

1. 本机 Chrome 打开核心页验证
2. 如改了 learn 数据，确认 id 无重复
3. 按 `../../RCJ-网站上线检查清单.md` 过一遍
