#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RCJ Exam Bank — 国考 PDF 底部店铺水印清理工具

真题 PDF 底部常带有“淘宝店铺：通关达人资料库”等横幅广告，扫描件与文字
混合无法直接删除对象；本工具在每页底部绘制白色矩形，物理遮盖水印。

与旧版 clean_shenlun_watermark.py 相比的升级：
  - 递归处理 guokao/bishi/{xingce,shenlun} 下全部 PDF；
  - 默认 y=760，可盖住位于 760-770 附近的水印带（2026 行测实测）；
  - 使用 garbage=4 + deflate 完整重写，避免多次 incremental save 累积 xref 损坏。

用法：
  python tools/clean_guokao_watermark.py

参数：
  --dir DIR      起始目录，默认 guokao/bishi
  --y Y          白色矩形起始 y 坐标，默认 760
  --dry-run      只统计/不修改
"""

import argparse
import glob
import os
import sys

import fitz

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DIR = os.path.join(ROOT, "guokao", "bishi")


def process_pdf(path: str, y_start: float, dry_run: bool) -> dict:
    doc = fitz.open(path)
    page_count = len(doc)
    height = doc[0].rect.height if page_count else 0
    modified = False
    for page in doc:
        rect = page.rect
        # ① 整页底部 y_start 到页底（横幅型水印）
        y0 = min(y_start, rect.height - 1)
        cover = fitz.Rect(0, y0, rect.width, rect.height)
        if not dry_run:
            page.draw_rect(cover, color=(1, 1, 1), fill=(1, 1, 1), width=0)
        # ② 右下角局部矩形，覆盖二维码类水印（2026 行测实测在 x=420..595, y=655..y0）
        # 只对 A4 类页面执行，避免误切非 A4 文档
        if rect.height >= 800 and rect.width >= 595 and y0 > 655:
            local = fitz.Rect(420, 655, rect.width, y0)
            if local.width > 0 and local.height > 0:
                if not dry_run:
                    page.draw_rect(local, color=(1, 1, 1),
                                   fill=(1, 1, 1), width=0)
        modified = True
    if not dry_run and modified:
        tmp = path + ".tmp"
        doc.save(tmp, garbage=4, deflate=True,
                 encryption=fitz.PDF_ENCRYPT_KEEP)
        doc.close()
        os.replace(tmp, path)
    else:
        doc.close()
    return {"path": path, "pages": page_count, "height": height,
            "modified": modified}


def main():
    parser = argparse.ArgumentParser(
        description="遮盖国考 PDF 底部店铺水印")
    parser.add_argument("--dir", default=DEFAULT_DIR,
                        help="要递归处理的目录，默认 guokao/bishi")
    parser.add_argument("--y", type=float, default=760,
                        help="白色矩形起始 y 坐标")
    parser.add_argument("--dry-run", action="store_true",
                        help="只预览不修改")
    args = parser.parse_args()

    if not os.path.isdir(args.dir):
        print("目录不存在：%s" % args.dir)
        sys.exit(1)

    pdfs = sorted(glob.glob(os.path.join(args.dir, "**", "*.pdf"),
                            recursive=True))
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
        print("  %s | pages=%d | h=%.1f" % (
            os.path.basename(res["path"]), res["pages"], res["height"]))

    print("\n完成。%s" % ("未写入文件（dry-run）" if args.dry_run
                         else "已覆盖原文件。"))


if __name__ == "__main__":
    main()
