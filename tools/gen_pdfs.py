#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RCJ Exam Bank — PDF 清单自动生成器（通用版）

扫描 <exam>/bishi/<科目>/ 下的真题 PDF，生成 <exam>/assets/pdf-manifest.js
（window.RCJ_PDFS 数组），供 <exam>/index.html 加载并展示「历年真题库」。

用法：
  python tools/gen_pdfs.py --exam guokao
  python tools/gen_pdfs.py --exam shengkao
  python tools/gen_pdfs.py                 # 默认 guokao

说明（也是“加新题库不出错”的经验固化）：
  - <exam>/bishi/ 下的每个子文件夹 = 一个科目，文件夹名映射到中文分类名
    （见 CAT_LABEL；未识别的文件夹直接用文件夹名作分类显示）。
  - 年份从文件名第一个 4 位连续数字提取（如 2025）。
  - 生成的 file 字段为相对 index.html 的路径：bishi/<文件夹>/<文件名>.pdf
    —— 注意是 file 不是 url，页面渲染器用 encodeURI(file) 拼相对路径。
  - 文件名里的特殊字符（+、不对称括号等）原样保留，不做改写，避免与原始资料对不上。
  - 科目排序由 index.html 的 RCJ_META.subjectOrder 决定（渲染端），本脚本只负责生成清单。

验收：生成后用  git ls-files '<exam>/bishi'  确认 PDF 已被跟踪，再 push。
"""

import os
import re
import json
import argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 文件夹名 -> 中文分类显示名
CAT_LABEL = {
    "xingce": "行测", "shenlun": "申论",
    "gongji": "公基", "zhice": "职测",
    "jiaozong": "教综", "xueke": "学科",
    "gonggong": "公共科目", "zhuanye": "专业科目",
}
# 分类排序权重（越小越靠前）；未列出的按标题字母序兜底
CAT_ORDER = {"行测": 0, "申论": 1, "公共科目": 0, "专业科目": 1,
             "公基": 2, "职测": 2, "教综": 2, "学科": 3}


def scan(exam):
    base = os.path.join(ROOT, exam, "bishi")
    if not os.path.isdir(base):
        print("⚠️ 未找到目录：%s（请先建 <exam>/bishi/<科目>/ 并放入 PDF）"
              % os.path.relpath(base, ROOT))
        return []
    pdfs = []
    for folder in sorted(os.listdir(base)):
        d = os.path.join(base, folder)
        if not os.path.isdir(d):
            continue
        cat = CAT_LABEL.get(folder, folder)  # 未识别的文件夹直接用原名作分类
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith(".pdf"):
                continue
            m = re.search(r"(\d{4})", fn)
            year = int(m.group(1)) if m else 0
            title = fn[:-4]  # 去掉 .pdf
            pdfs.append({
                "year": year,
                "cat": cat,
                "title": title,
                "file": "bishi/%s/%s" % (folder, fn),
            })
    # 分类权重升序；同分类内年份降序；年份相同按标题稳定排序
    pdfs.sort(key=lambda p: (CAT_ORDER.get(p["cat"], 50), -p["year"], p["title"]))
    return pdfs


def main():
    ap = argparse.ArgumentParser(description="生成考试 PDF 清单 manifest")
    ap.add_argument("--exam", default="guokao", help="考试目录名（默认 guokao）")
    args = ap.parse_args()

    pdfs = scan(args.exam)
    out = os.path.join(ROOT, args.exam, "assets", "pdf-manifest.js")

    # ⚠️ Cloudflare Pages 单文件硬上限 25MB：超限 PDF 会导致整个部署上传失败/
    # 卡死（边缘节点半成品、缺失文件兜底成首页），排查极难。生成清单时先预检。
    CF_PAGES_MAX_MB = 25
    over = []
    for p in pdfs:
        fp = os.path.join(ROOT, args.exam, p["file"])
        try:
            mb = os.path.getsize(fp) / 1048576.0
        except OSError:
            continue
        if mb > CF_PAGES_MAX_MB:
            over.append((mb, p["file"]))
    if over:
        print("\n⛔⛔⛔ 发现超过 Cloudflare Pages 25MB 上限的 PDF（会导致部署失败）⛔⛔⛔")
        for mb, f in sorted(over, reverse=True):
            print("   %.1f MB  %s" % (mb, f))
        print("   处理：用 PyMuPDF 降 DPI + JPEG 重压缩到 25MB 内（文件名不变，manifest 无需改）")
        print("   例：python -c \"import fitz,os; ...\"  或见本仓库 25MB 预检说明\n")

    header = (
        "// %s真题清单 —— 由 tools/gen_pdfs.py 自动生成，勿手改\n"
        "// 字段说明：\n"
        "//   year : 年份（数字，如 2025）\n"
        "//   cat  : 科目分类显示名，需与 index.html 里 RCJ_META.subjectOrder 对应（行测 / 申论）\n"
        "//   title: 卡片标题，一般用文件名去掉 .pdf\n"
        "//   file : 相对本页 index.html 的路径，形如 bishi/xingce/xxx.pdf\n"
        "// 新增/删除 PDF 后重跑： python tools/gen_pdfs.py --exam %s\n"
        % (args.exam, args.exam)
    )

    lines = ["window.RCJ_PDFS = ["]
    body = ",\n".join(
        "  { year:%d, cat:%s, title:%s, file:%s }"
        % (p["year"], json.dumps(p["cat"], ensure_ascii=False),
           json.dumps(p["title"], ensure_ascii=False),
           json.dumps(p["file"], ensure_ascii=False))
        for p in pdfs
    )
    if body:
        lines.append(body)
    lines.append("];")
    content = header + "\n".join(lines) + "\n"

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(content)

    print("已生成 %d 套真题清单 -> %s" % (len(pdfs), os.path.relpath(out, ROOT)))
    for p in pdfs:
        print("  [%s] %d %s" % (p["cat"], p["year"], p["title"][:24]))


if __name__ == "__main__":
    main()
