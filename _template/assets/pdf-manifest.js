// 真题清单 —— 推荐用脚本自动生成： python tools/gen_pdfs.py --exam <考试目录名>
// 也可手填，字段说明：
//   year : 年份（数字，如 2025）
//   cat  : 科目分类显示名，需与 index.html 里 RCJ_META.subjectOrder 对应
//   title: 卡片标题，一般用文件名去掉 .pdf
//   file : 相对本页 index.html 的路径，形如 bishi/xingce/xxx.pdf   ← 注意是 file 不是 url
// 放 PDF：把文件按科目放进 <考试目录>/bishi/<科目>/ 下，再跑上面的脚本即可自动生成（防手填字段出错）。
window.RCJ_PDFS = [
  // 示例（放入真实 PDF 后删掉这行、跑脚本即可自动生成）：
  // { year:2025, cat:"行测", title:"2025年某省考《行测》题（县级）", file:"bishi/xingce/2025年某省考《行测》题（县级）.pdf" },
];
