#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RCJ Exam Bank — PDF 清单自动生成器
扫描 guokao/bishi/{xingce,shenlun} 下的真题 PDF，生成 guokao/assets/pdf-manifest.js
（window.RCJ_PDFS 数组），供 guokao/index.html 加载并展示「历年真题 PDF 免费下载」板块。

用法（任选其一）：
  1) 手动：仓库根目录执行  python tools/gen_pdfs.py
  2) 自动：push 到 main 后，.github/workflows/sync-pdfs.yml 会自动跑本脚本，
            并把更新后的 manifest 提交回去，触发 Cloudflare Pages 重新部署 —— 网页即同步。

注意：文件名里若存在特殊字符（+、"、"...."、不对称括号等）会原样保留，不做改写，
      避免与原始资料对不上。
"""

import os
import re
import json

# 以脚本所在位置的上级（仓库根）为基准
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "guokao", "bishi")
OUT = os.path.join(ROOT, "guokao", "assets", "pdf-manifest.js")

# 文件夹 -> 分类显示名
CAT_MAP = {
    "xingce": "行测",
    "shenlun": "申论",
}
# 分类排序权重（越小越靠前）
CAT_ORDER = {"行测": 0, "申论": 1}


def scan():
    pdfs = []
    for folder, cat in CAT_MAP.items():
        d = os.path.join(BASE, folder)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith(".pdf"):
                continue
            m = re.search(r"(\d{4})", fn)
            year = int(m.group(1)) if m else 0
            title = fn[:-4]  # 去掉 .pdf
            pdfs.append(
                {
                    "year": year,
                    "cat": cat,
                    "title": title,
                    "file": "bishi/%s/%s" % (folder, fn),
                }
            )
    # 行测在前、申论在后；同分类内年份降序；年份相同按标题稳定排序
    pdfs.sort(key=lambda p: (CAT_ORDER.get(p["cat"], 9), -p["year"], p["title"]))
    return pdfs


def main():
    pdfs = scan()
    # 生成 JS 数组文本，每个条目一行，便于 diff 和人工核对
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
    content = "\n".join(lines) + "\n"

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(content)

    print("已生成 %s 套真题清单 -> %s" % (len(pdfs), os.path.relpath(OUT, ROOT)))
    for p in pdfs:
        print("  [%s] %d %s" % (p["cat"], p["year"], p["title"][:24]))


if __name__ == "__main__":
    main()
