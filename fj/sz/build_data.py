#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_data.py — 把可编辑的 data.json 生成离线运行时 data.js（window.DATA = [...]）。

为什么分两个文件：
    data.json  = 人维护的「源文件」，新增/修改题目只改这里，好读好改。
    data.js    = 浏览器直接 <script src> 加载（window.DATA），离线 file:// 也能用，
                 无需 fetch（fetch 在 file:// 下被 CORS 拦截）。CDN 上设 immutable 长缓存。

用法：
    python build_data.py data.json -o data.js
    python build_data.py data.json -o data.js --minify        # 压缩单行，体积更小
    python build_data.py 题目.csv -o data.js --from csv        # 一步：源文件→data.js（顺带生成 data.json）

说明：
    - 自动补 num（缺则顺延）与 _idx（数组下标）。
    - --from 时直接调用 ingest 逻辑，省去中间 data.json（但建议保留 data.json 便于后续维护）。
"""
import json
import os
import sys
import argparse
import datetime

HERE = os.path.dirname(os.path.abspath(__file__))


def load_data(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get('questions', data.get('data', []))
    return data


def finalize(data, auto_num=False):
    for i, q in enumerate(data):
        if 'num' in q and not isinstance(q.get('num'), int):
            q['num'] = i + 1
        elif auto_num and 'num' not in q:
            q['num'] = i + 1
        q['_idx'] = i
    return data


def emit_js(data, out, minify, global_name='DATA'):
    if minify:
        payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    else:
        payload = json.dumps(data, ensure_ascii=False, indent=1)
    content = f"window.{global_name} = {payload};\n"
    with open(out, 'w', encoding='utf-8') as f:
        f.write(content)
    return len(content.encode('utf-8'))


def emit_config(config_path, out, minify=False):
    """把 template-config.json 编译成 config.js（window.SITE_CONFIG）。
    站点配置不靠 fetch（file:// 下 fetch 被 CORS 拦），统一走全局变量。
    """
    with open(config_path, encoding='utf-8') as f:
        cfg = json.load(f)
    if minify:
        payload = json.dumps(cfg, ensure_ascii=False, separators=(',', ':'))
    else:
        payload = json.dumps(cfg, ensure_ascii=False, indent=1)
    content = f"window.SITE_CONFIG = {payload};\n"
    with open(out, 'w', encoding='utf-8') as f:
        f.write(content)
    return len(content.encode('utf-8'))


def emit_version(config_path, version_path, version="1.0.0"):
    """根据 template-config.json 的 datasets 统计各模式题量，生成 VERSION.json。
    VERSION.json 由脚本自动生成，禁止人工修改（updated 取当天日期）。
    viewer.html 读取后显示：版本号 / 更新时间 / 各模式题量。
    """
    with open(config_path, encoding='utf-8') as f:
        cfg = json.load(f)
    datasets = cfg.get('datasets', [])
    counts = {}
    for ds in datasets:
        mode = ds.get('mode')
        jpath = ds.get('json')
        n = 0
        if jpath and os.path.exists(jpath):
            try:
                n = len(load_data(jpath))
            except Exception as e:
                print(f"[!] 统计 {jpath} 失败：{e}")
        counts[mode] = n
    ver = {
        "version": version,
        "updated": datetime.date.today().isoformat(),
        "counts": counts,
    }
    if 'written' in counts:
        # 笔试已下架（hideWrittenCount）时不出"笔试 N"，页脚只显示面试题量
        ver['writtenCount'] = None if cfg.get('hideWrittenCount') else counts['written']
    if 'interview' in counts:
        ver['interviewCount'] = counts['interview']
    with open(version_path, 'w', encoding='utf-8') as f:
        json.dump(ver, f, ensure_ascii=False, indent=2)
    total = sum(counts.values())
    print(f"[+] 已生成 {version_path}：version={version}，updated={ver['updated']}，题量={counts}（合计 {total}）")
    return ver


def main():
    ap = argparse.ArgumentParser(description="data.json → data.js（window.DATA）")
    ap.add_argument("input", help="data.json 或源文件 csv/xlsx/json/txt")
    ap.add_argument("-o", "--out", default="data.js", help="输出 JS，默认 data.js")
    ap.add_argument("--minify", action="store_true", help="压缩为单行")
    ap.add_argument("--from", dest="src", choices=['csv', 'xlsx', 'json', 'txt'], default=None,
                    help="源格式：若 input 是源文件，指定其格式走 ingest 流程")
    ap.add_argument("--keep-json", default=None, help="--from 时顺带写出的 data.json 路径")
    ap.add_argument("--auto-num", action="store_true",
                    help="源数据缺 num 时自动补 i+1；默认保留原样（不补）")
    ap.add_argument("--global-name", default="DATA",
                    help="输出 JS 的全局变量名（默认 DATA）。合并站点用：笔试=data-written.js 设 DATA_WRITTEN，面试=data-interview.js 设 DATA_INTERVIEW")
    ap.add_argument("--config", default=None,
                    help="模板配置 template-config.json，顺带生成 config.js（window.SITE_CONFIG）")
    ap.add_argument("--emit-config", default="config.js",
                    help="--config 时输出的 JS 文件名，默认 config.js")
    ap.add_argument("--emit-version", action="store_true",
                    help="根据 --config 的 datasets 统计各模式题量，生成 VERSION.json")
    ap.add_argument("--version-file", default="VERSION.json",
                    help="--emit-version 时输出的文件路径，默认 VERSION.json")
    ap.add_argument("--template-version", default="1.0.0",
                    help="--emit-version 时写入的版本号，默认 1.0.0")
    args = ap.parse_args()

    ext = os.path.splitext(args.input)[1].lower()
    if args.src or ext == '.json':
        if args.src in (None, 'json') and ext == '.json':
            data = load_data(args.input)
        else:
            # 走 ingest
            sys.path.insert(0, HERE)
            import ingest
            fmt = args.src or ({'.csv': 'csv', '.xlsx': 'xlsx', '.xls': 'xlsx',
                                '.txt': 'txt'}.get(ext))
            if fmt == 'csv':
                data = ingest.read_csv(args.input)
            elif fmt == 'xlsx':
                data = ingest.read_xlsx(args.input)
            elif fmt == 'txt':
                data = ingest.read_txt(args.input)
            else:
                raise SystemExit("[!] 无法判断源格式，请用 --from")
            if args.keep_json:
                os.makedirs(os.path.dirname(os.path.abspath(args.keep_json)) or '.', exist_ok=True)
                with open(args.keep_json, 'w', encoding='utf-8') as f:
                    json.dump(ingest.finalize(data), f, ensure_ascii=False, indent=2)
                print(f"[+] 已顺带写出源文件 {args.keep_json}")
    else:
        raise SystemExit("[!] input 需为 data.json，或加 --from 指定源格式")

    data = finalize(data, args.auto_num)
    size = emit_js(data, args.out, args.minify, args.global_name)
    print(f"[+] 已生成 {args.out}：{len(data)} 题，{size} 字节（{'压缩' if args.minify else '格式化'}，全局 {args.global_name}）")
    print(f"[+] 在 HTML 中通过 <script src=\"{os.path.basename(args.out)}\"></script> 引入即可（置于应用脚本之前）")

    if args.config:
        csize = emit_config(args.config, args.emit_config, args.minify)
        print(f"[+] 已生成 {args.emit_config}（window.SITE_CONFIG，{csize} 字节）")
        if args.emit_version:
            emit_version(args.config, args.version_file, args.template_version)


if __name__ == "__main__":
    main()
