# 迁移：civil-service-interview → rcj-exam-bank

## 目标

公考内容只保留一个家（`rcj-exam-bank`），避免两个公考仓库并存导致的用户混淆与维护分裂。

## 内容映射

| 原仓库内容 | 迁入位置 |
|---|---|
| 公考面试真题 JSON | `rcj-exam-bank/<考试类型>/data-interview.json`（按国考/省考归到 `guokao/` `shengkao/` 等） |
| AI 点评 / 录音模块 | 对应实例开启 `enabledModules.record`；通用逻辑留在 `rcj-exam-builder` 模板 |
| Anki 卡包 | 随数据一并迁入，沿用 `rcj-exam-bank` 的 Anki 导出流程 |

## 旧仓库处置（不删）

1. github.com 把 `civil-service-interview` 设为 **Archive**（Settings → 勾选 Archive，变只读）。
2. 改其 README 顶部加醒目重定向：
   > ⚠️ 本仓库内容已并入 [**rcj-exam-bank**](https://github.com/<you>/rcj-exam-bank)，公考笔试/面试请移步新仓库。
3. 保留历史 commit 供追溯。

## 注意

- 真品牌前缀 `rcj-`，与 `aux-`/`xf-` 已上线仓并存属有意保留（零停机）。
- 迁移前先备份原仓库（fork 或本地 clone）。
