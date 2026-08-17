# 演示视频资产清单（单一事实来源 · Single Source of Truth）

> 规则：**GitHub 仓库不再存放 mp4 源文件**，三个演示视频统一托管在 Telegram（经 `rcj-tg-proxy` 反代），
> 页面用反代地址引用，避免 Pages 带宽占用与加载卡顿。
> 本地源文件放工作区根目录 **`_media/{V|L}{序号}_{主题}.mp4`**（与 `_repos`、`projects` 同级，**独立于 GitHub 仓库**），不推送 Pages。
> 任何“存取 / 引用 / 替换”操作，都以本表为准，禁止凭记忆写 file_id 或 URL。

## 编号规则
- **双系列、互不打乱**：
  - **V# 系列** = `demo` 演示视频（当前 V1–V3），按页面卡片顺序。
  - **L# 系列** = letout 音频短视频（无版权素材），与 V# 完全独立编号，避免引用串台。
- 文件名统一 `{系列}{序号}_{主题}.mp4` 与 `{系列}{序号}_{主题}.poster.jpg`（如 `L1_xxx.mp4`），文件名即编号，肉眼可辨。

## 工作区目录约定（保持 products 纯粹）
- `_repos/`：GitHub 仓库文件（纯仓库，**不要塞大文件/无关资源**）
- `projects/`：成品
- 根目录 *.md：开发文档
- `_media/`：本地视频源（ffmpeg 加工后的成品源、Telegram 备份源），**不进任何仓库**

## 资产明细

| 编号 | 主题 | 本地备份（_media，不推送） | Telegram file_id | 反代地址（页面引用） | Poster（随仓库） |
|------|------|---------------------------|------------------|----------------------|------------------|
| V1 | Anki 记忆卡组 | `_media/V1_anki.mp4` | `BAACAgUAAyEGAAMBCRddMAADB2qCgQ_CeMiQE-uLJzsTr4JEsTbaAALLIwAC-KURVBwbbaKMzHEsPQQ` | `https://rcj-tg-proxy.rcjstore.workers.dev/f/BAACAgUAAyEGAAMBCRddMAADB2qCgQ_CeMiQE-uLJzsTr4JEsTbaAALLIwAC-KURVBwbbaKMzHEsPQQ?v=3` | `V1_anki.poster.jpg` |
| V2 | 离线 HTML 刷题 | `_media/V2_quiz.mp4` | `BAACAgUAAyEGAAMBCRddMAADCGqCgROCTRVVvgIrthF3R0vaxJa-AALMIwAC-KURVOizyLF5b4GTPQQ` | `https://rcj-tg-proxy.rcjstore.workers.dev/f/BAACAgUAAyEGAAMBCRddMAADCGqCgROCTRVVvgIrthF3R0vaxJa-AALMIwAC-KURVOizyLF5b4GTPQQ?v=3` | `V2_quiz.poster.jpg` |
| V3 | 在线资源 | `_media/V3_online.mp4` | `BAACAgUAAyEGAAMBCRddMAADCWqCgRxApZRWIqa33YArTIfrSMiTAALNIwAC-KURVCA8V0CZwN6UPQQ` | `https://rcj-tg-proxy.rcjstore.workers.dev/f/BAACAgUAAyEGAAMBCRddMAADCWqCgRxApZRWIqa33YArTIfrSMiTAALNIwAC-KURVCA8V0CZwN6UPQQ?v=3` | `V3_online.poster.jpg` |

## L# 系列（letout 音频短视频 · 无版权素材）

> 后续陆续把 letout 音频做成无版权短视频，统一走 Telegram 托管 + **L# 独立编号**，沿用上方工作流。
> 新增时在此追加一行即可（编号 L1、L2… 顺延），不占用 V# 序列，避免引用串台。

| 编号 | 主题 | 本地备份（_media，不推送） | Telegram file_id | 反代地址（页面引用） | Poster（随仓库） |
|------|------|---------------------------|------------------|----------------------|------------------|
| （待添加） | | | | | |

## 反代基址与账号
- 反代基址：`https://rcj-tg-proxy.rcjstore.workers.dev/f/<file_id>`
- 缓存：CDN 缓存 1 天；引用后接 `?v=N` 作为版本号，替换视频时递增（当前 `v=3`）。
- Bot：`@rcj_tg_store_bot` ｜ 频道：`1004447493424`

## 标准工作流（本地加工 → Telegram 托管）
1. **本地加工**：用本机 ffmpeg 把原始视频压制成小体积（如 `-c:v libx264 -crf 29 -preset slow -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 64k`），输出到 `_media/{V|L}{序号}_{主题}.mp4`。**不要直接用手机上传原始大文件**。
2. **上传 Telegram**：把 `_media/{V|L}*.mp4` 发给 `@rcj_tg_store_bot`（或发到频道 `1004447493424`），拿到 `file_id`。
3. **登记**：只改本表与 `demo/index.html` 对应那一行的 file_id 与 `?v=` 版本号；旧备份改名 `V{序号}_{主题}.mp4.bak` 留一周再删。
4. **校验**：`curl -A "Mozilla/5.0" https://rcj-tg-proxy.rcjstore.workers.dev/f/<new_file_id>` 确认返回 `200` 且 `Content-Type: application/octet-stream`。

## 操作约定（防错）
- **页面引用**：`demo/index.html` 只写反代地址；视频标签上方用 `<!-- V1 · 主题 -->` 注释标明编号。
- **本地备份**：源文件只放 `_media/`，勿改名、勿提交进仓库。
- **替换视频**：重传 → 拿新 file_id → 同步本表 + `index.html`；旧源保留一周备份。
