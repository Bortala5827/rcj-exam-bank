# 演示视频资产清单（单一事实来源 · Single Source of Truth）

> 规则：**仓库不再存放 mp4 源文件**，三个演示视频统一托管在 Telegram（经 `rcj-tg-proxy` 反代），
> 页面用反代地址引用，避免 Pages 带宽占用与加载卡顿。
> 本地 `demo/assets/videos/V*.mp4` 仅作**备份**，已被 `.gitignore` 忽略，不会推送到 Pages。
> 任何“存取 / 引用 / 替换”操作，都以本表为准，禁止凭记忆写 file_id 或 URL。

## 编号规则
- 按页面卡片顺序编号：**V1 = 卡片1（Anki 记忆卡组）／ V2 = 卡片2（离线 HTML 刷题）／ V3 = 卡片3（在线资源）**
- 文件名统一 `V{序号}_{主题}.mp4` 与 `V{序号}_{主题}.poster.jpg`，文件名即编号，肉眼可辨，避免张冠李戴。

## 资产明细

| 编号 | 主题 | 本地备份（不推送） | Telegram file_id | 反代地址（页面引用） | Poster |
|------|------|-------------------|------------------|----------------------|--------|
| V1 | Anki 记忆卡组 | `V1_anki.mp4` | `BAACAgUAAyEGAAMBCRddMAADB2qCgQ_CeMiQE-uLJzsTr4JEsTbaAALLIwAC-KURVBwbbaKMzHEsPQQ` | `https://rcj-tg-proxy.rcjstore.workers.dev/f/BAACAgUAAyEGAAMBCRddMAADB2qCgQ_CeMiQE-uLJzsTr4JEsTbaAALLIwAC-KURVBwbbaKMzHEsPQQ?v=3` | `V1_anki.poster.jpg` |
| V2 | 离线 HTML 刷题 | `V2_quiz.mp4` | `BAACAgUAAyEGAAMBCRddMAADCGqCgROCTRVVvgIrthF3R0vaxJa-AALMIwAC-KURVOizyLF5b4GTPQQ` | `https://rcj-tg-proxy.rcjstore.workers.dev/f/BAACAgUAAyEGAAMBCRddMAADCGqCgROCTRVVvgIrthF3R0vaxJa-AALMIwAC-KURVOizyLF5b4GTPQQ?v=3` | `V2_quiz.poster.jpg` |
| V3 | 在线资源 | `V3_online.mp4` | `BAACAgUAAyEGAAMBCRddMAADCWqCgRxApZRWIqa33YArTIfrSMiTAALNIwAC-KURVCA8V0CZwN6UPQQ` | `https://rcj-tg-proxy.rcjstore.workers.dev/f/BAACAgUAAyEGAAMBCRddMAADCWqCgRxApZRWIqa33YArTIfrSMiTAALNIwAC-KURVCA8V0CZwN6UPQQ?v=3` | `V3_online.poster.jpg` |

## 反代基址与账号
- 反代基址：`https://rcj-tg-proxy.rcjstore.workers.dev/f/<file_id>`
- 缓存：CDN 缓存 1 天；引用后接 `?v=N` 作为版本号，替换视频时递增（当前 `v=3`）。
- Bot：`@rcj_tg_store_bot` ｜ 频道：`1004447493424`

## 操作约定（防错）
1. **页面引用**：`demo/index.html` 里只写反代地址；视频标签上方用 `<!-- V1 · 主题 -->` 注释标明编号。
2. **本地备份**：重编码后的源文件放 `demo/assets/videos/V{序号}_{主题}.mp4`，勿改名、勿提交。
3. **替换视频**：重新上传到 Bot → 拿到新 file_id → 只改本表与 `index.html` 中对应那一行的 file_id 与 `?v=` 版本号；旧备份保留为 `V{序号}_{主题}.mp4.bak` 一周再删。
4. **校验**：替换后用 `curl -A "Mozilla/5.0" https://rcj-tg-proxy.rcjstore.workers.dev/f/<new_file_id>` 确认返回 `200` 且 `Content-Type: application/octet-stream`。
