#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RCJ Exam Bank — 申论 PDF 底部水印清理工具

申论真题 PDF 通常为扫描件，底部被盖上淘宝店铺广告横幅（如
"【认准淘宝店铺：通关达人资料库】..."）。该横幅与正文内容不在同一层，
无法通过删除对象移除；本工具在每页底部绘制一个白色矩形，将其物理遮盖。

用法：
  python tools/clean_shenlun_watermark.py

参数：
  --dir DIR      要处理的目录，默认 guokao/bishi/shenlun
  --y Y          白色矩形起始 y 坐标（PDF 页面坐标，页顶为 0），默认 780
  --dry-run      只统计/不修改

说明：
  - 白色矩形从 y 到页底，会同时遮盖页脚页码；申论页码在浏览器/PDF 阅读器
    中通常可通过侧边栏查看，权衡后接受。
  - y=780 在现有 13 套国考申论中可完全盖住水印；极少数页面正文可能延伸到
    y≈794，因此会损失约 14pt（≈5mm）的底部边距。如需保留更多正文，可改用
    y=790（但可能残留淡印）。
"""

import argparse
import glob
import os
import shutil
import sys

import fitz

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DIR = os.path.join(ROOT, "guokao", "bishi", "shenlun")


def process_pdf(path: str, y_start: float, dry_run: bool) -> dict:
    doc = fitz.open(path)
    page_count = doc.page_count
    modified = False
    for page in doc:
        rect = page.rect
        cover = fitz.Rect(0, y_start, rect.width, rect.height)
        if not dry_run:
            page.draw_rect(cover, color=(1, 1, 1), fill=(1, 1, 1), width=0)
        modified = True
    if not dry_run:
        # garbage=4 尽量复用对象、deflate 压缩，避免文件膨胀过大
        doc.save(path, incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    return {"path": path, "pages": page_count, "modified": modified}


def main():
    parser = argparse.ArgumentParser(description="遮盖申论 PDF 底部店铺水印")
    parser.add_argument("--dir", default=DEFAULT_DIR, help="申论 PDF 目录")
    parser.add_argument("--y", type=float, default=780, help="白色矩形起始 y 坐标")
    parser.add_argument("--dry-run", action="store_true", help="只预览不修改")
    args = parser.parse_args()

    if not os.path.isdir(args.dir):
        print("目录不存在：%s" % args.dir)
        sys.exit(1)

    pdfs = sorted(glob.glob(os.path.join(args.dir, "*.pdf")))
    if not pdfs:
        print("未找到 PDF：%s" % args.dir)
        sys.exit(0)

    print("模式：%s | 目录：%s | 白色矩形 y=%.1f 到页底" % (
        "dry-run" if args.dry_run else "修改", args.dir, args.y))
    print("共发现 %d 个 PDF\n" % len(pdfs))

    results = []
    for pdf in pdfs:
        res = process_pdf(pdf, args.y, args.dry_run)
        results.append(res)
        print("  %s (%d 页)" % (os.path.basename(res["path"]), res["pages"]))

    print("\n完成。%s" % ("未写入文件（dry-run）" if args.dry_run else "已覆盖原文件。"))


if __name__ == "__main__":
    main()
