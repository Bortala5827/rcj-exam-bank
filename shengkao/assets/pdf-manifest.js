// shengkao真题清单 —— 由 tools/gen_pdfs.py 自动生成，勿手改
// 字段说明：
//   year : 年份（数字，如 2025）
//   cat  : 科目分类显示名，需与 index.html 里 RCJ_META.subjectOrder 对应（行测 / 申论）
//   title: 卡片标题，一般用文件名去掉 .pdf
//   file : 相对本页 index.html 的路径，形如 bishi/xingce/xxx.pdf
//   size : 文件大小（MB，保留1位小数），列表页据此提示加载耗时
// 新增/删除 PDF 后重跑： python tools/gen_pdfs.py --exam shengkao
window.RCJ_PDFS = [
  { year:2026, cat:"行测", title:"2026年广东省考《行测》真题", file:"bishi/xingce/2026年广东省考《行测》真题.pdf", size:18.9 },
  { year:2026, cat:"行测", title:"2026年广东省考《行测》答案解析", file:"bishi/xingce/2026年广东省考《行测》答案解析.pdf", size:3.5 },
  { year:2025, cat:"行测", title:"2025年广东省公务员录用考试《行测》答案及解析", file:"bishi/xingce/2025年广东省公务员录用考试《行测》答案及解析.pdf", size:2.0 },
  { year:2025, cat:"行测", title:"2025年广东省公务员录用考试《行测》题", file:"bishi/xingce/2025年广东省公务员录用考试《行测》题.pdf", size:0.9 },
  { year:2024, cat:"行测", title:"2024年广东省公务员录用考试《行测》答案及解析", file:"bishi/xingce/2024年广东省公务员录用考试《行测》答案及解析.pdf", size:0.8 },
  { year:2024, cat:"行测", title:"2024年广东省公务员录用考试《行测》题", file:"bishi/xingce/2024年广东省公务员录用考试《行测》题.pdf", size:0.9 },
  { year:2023, cat:"行测", title:"2023年广东省公务员录用考试《行测》题（乡镇卷）", file:"bishi/xingce/2023年广东省公务员录用考试《行测》题（乡镇卷）.pdf", size:0.9 },
  { year:2023, cat:"行测", title:"2023年广东省公务员录用考试《行测》题（乡镇卷）答案解析", file:"bishi/xingce/2023年广东省公务员录用考试《行测》题（乡镇卷）答案解析.pdf", size:0.8 },
  { year:2023, cat:"行测", title:"2023年广东省公务员录用考试《行测》题（县级卷）", file:"bishi/xingce/2023年广东省公务员录用考试《行测》题（县级卷）.pdf", size:1.0 },
  { year:2023, cat:"行测", title:"2023年广东省公务员录用考试《行测》题（县级卷）答案解析", file:"bishi/xingce/2023年广东省公务员录用考试《行测》题（县级卷）答案解析.pdf", size:0.9 },
  { year:2022, cat:"行测", title:"2022年广东公务员考试行测试题（乡镇）", file:"bishi/xingce/2022年广东公务员考试行测试题（乡镇）.pdf", size:0.9 },
  { year:2022, cat:"行测", title:"2022年广东公务员考试行测试题（乡镇）答案解析", file:"bishi/xingce/2022年广东公务员考试行测试题（乡镇）答案解析.pdf", size:1.1 },
  { year:2022, cat:"行测", title:"2022年广东公务员考试行测试题（县级）", file:"bishi/xingce/2022年广东公务员考试行测试题（县级）.pdf", size:0.9 },
  { year:2022, cat:"行测", title:"2022年广东公务员考试行测试题（县级）答案解析", file:"bishi/xingce/2022年广东公务员考试行测试题（县级）答案解析.pdf", size:1.2 },
  { year:2026, cat:"申论", title:"2026年广东省考《申论》真题（公安）", file:"bishi/shenlun/2026年广东省考《申论》真题（公安）.pdf", size:5.0 },
  { year:2026, cat:"申论", title:"2026年广东省考《申论》真题（县镇）", file:"bishi/shenlun/2026年广东省考《申论》真题（县镇）.pdf", size:8.8 },
  { year:2026, cat:"申论", title:"2026年广东省考《申论》真题（省市）", file:"bishi/shenlun/2026年广东省考《申论》真题（省市）.pdf", size:9.4 },
  { year:2026, cat:"申论", title:"2026年广东省考《申论》真题（行政执法）", file:"bishi/shenlun/2026年广东省考《申论》真题（行政执法）.pdf", size:5.2 },
  { year:2025, cat:"申论", title:"2025年广东省考《申论》真题（公安）", file:"bishi/shenlun/2025年广东省考《申论》真题（公安）.pdf", size:5.7 },
  { year:2025, cat:"申论", title:"2025年广东省考《申论》真题（县镇）", file:"bishi/shenlun/2025年广东省考《申论》真题（县镇）.pdf", size:9.9 },
  { year:2025, cat:"申论", title:"2025年广东省考《申论》真题（省市）", file:"bishi/shenlun/2025年广东省考《申论》真题（省市）.pdf", size:9.6 },
  { year:2025, cat:"申论", title:"2025年广东省考《申论》真题（行政执法）", file:"bishi/shenlun/2025年广东省考《申论》真题（行政执法）.pdf", size:5.0 },
  { year:2024, cat:"申论", title:"2024年公务员广东省考《申论》题（一卷）及参考答案", file:"bishi/shenlun/2024年公务员广东省考《申论》题（一卷）及参考答案.pdf", size:0.3 },
  { year:2024, cat:"申论", title:"2024年公务员广东省考《申论》题（三卷-行政执法）及参考答案", file:"bishi/shenlun/2024年公务员广东省考《申论》题（三卷-行政执法）及参考答案.pdf", size:1.4 },
  { year:2024, cat:"申论", title:"2024年公务员广东省考《申论》题（二卷）及参考答案", file:"bishi/shenlun/2024年公务员广东省考《申论》题（二卷）及参考答案.pdf", size:0.3 },
  { year:2023, cat:"申论", title:"2023年广东省公考《申论》题（乡镇）及参考答案", file:"bishi/shenlun/2023年广东省公考《申论》题（乡镇）及参考答案.pdf", size:0.6 },
  { year:2023, cat:"申论", title:"2023年广东省公考《申论》题（县级）及参考答案", file:"bishi/shenlun/2023年广东省公考《申论》题（县级）及参考答案.pdf", size:0.4 },
  { year:2022, cat:"申论", title:"2022年广东省公务员考试申论真题及答案（乡镇卷）", file:"bishi/shenlun/2022年广东省公务员考试申论真题及答案（乡镇卷）.pdf", size:0.3 },
  { year:2022, cat:"申论", title:"2022年广东省公务员考试申论真题及答案（县级卷）", file:"bishi/shenlun/2022年广东省公务员考试申论真题及答案（县级卷）.pdf", size:0.3 }
];
