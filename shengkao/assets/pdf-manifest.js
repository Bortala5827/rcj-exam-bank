// shengkao真题清单 —— 由 tools/gen_pdfs.py 自动生成，勿手改
// 字段说明：
//   year : 年份（数字，如 2025）
//   cat  : 科目分类显示名，需与 index.html 里 RCJ_META.subjectOrder 对应（行测 / 申论）
//   title: 卡片标题，一般用文件名去掉 .pdf
//   file : 相对本页 index.html 的路径，形如 bishi/xingce/xxx.pdf
//   size : 文件大小（MB，保留1位小数），列表页据此提示加载耗时
// 新增/删除 PDF 后重跑： python tools/gen_pdfs.py --exam shengkao
//
// 2026-08-05 更新：省考真题已下架，统一前往公开真题库 https://exam.955827.xyz/ 查看 / 下载。
window.RCJ_PDFS = [];
