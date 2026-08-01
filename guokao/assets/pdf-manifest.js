// guokao真题清单 —— 由 tools/gen_pdfs.py 自动生成，勿手改
// 字段说明：
//   year : 年份（数字，如 2025）
//   cat  : 科目分类显示名，需与 index.html 里 RCJ_META.subjectOrder 对应（行测 / 申论）
//   title: 卡片标题，一般用文件名去掉 .pdf
//   file : 相对本页 index.html 的路径，形如 bishi/xingce/xxx.pdf
//   size : 文件大小（MB，保留1位小数），列表页据此提示加载耗时
// 新增/删除 PDF 后重跑： python tools/gen_pdfs.py --exam guokao
window.RCJ_PDFS = [
  { year:2026, cat:"行测", title:"2026年国家公务员录用考试《行测》题（副省级）", file:"bishi/xingce/2026年国家公务员录用考试《行测》题（副省级）.pdf", size:1.4 },
  { year:2026, cat:"行测", title:"2026年国家公务员录用考试《行测》题（地市级）", file:"bishi/xingce/2026年国家公务员录用考试《行测》题（地市级）.pdf", size:1.4 },
  { year:2026, cat:"行测", title:"2026年国家公务员录用考试《行测》题（行政执法卷）", file:"bishi/xingce/2026年国家公务员录用考试《行测》题（行政执法卷）.pdf", size:1.7 },
  { year:2025, cat:"行测", title:"2025年国家公务员录用考试《行测》题（副省级）", file:"bishi/xingce/2025年国家公务员录用考试《行测》题（副省级）.pdf", size:1.8 },
  { year:2025, cat:"行测", title:"2025年国家公务员录用考试《行测》题（地市级）", file:"bishi/xingce/2025年国家公务员录用考试《行测》题（地市级）.pdf", size:1.9 },
  { year:2025, cat:"行测", title:"2025年国家公务员录用考试《行测》题（行政执法卷）", file:"bishi/xingce/2025年国家公务员录用考试《行测》题（行政执法卷）.pdf", size:1.9 },
  { year:2024, cat:"行测", title:"2024年国家公务员录用考试《行测》题（副省级）", file:"bishi/xingce/2024年国家公务员录用考试《行测》题（副省级）.pdf", size:2.2 },
  { year:2024, cat:"行测", title:"2024年国家公务员录用考试《行测》题（地市级）", file:"bishi/xingce/2024年国家公务员录用考试《行测》题（地市级）.pdf", size:1.8 },
  { year:2024, cat:"行测", title:"2024年国家公务员录用考试《行测》题（行政执法卷）", file:"bishi/xingce/2024年国家公务员录用考试《行测》题（行政执法卷）.pdf", size:1.4 },
  { year:2023, cat:"行测", title:"2023年国家公务员录用考试《行测》真题（副省级）", file:"bishi/xingce/2023年国家公务员录用考试《行测》真题（副省级）.pdf", size:1.0 },
  { year:2023, cat:"行测", title:"2023年国家公务员录用考试《行测》真题（地市级）", file:"bishi/xingce/2023年国家公务员录用考试《行测》真题（地市级）.pdf", size:1.0 },
  { year:2023, cat:"行测", title:"2023年国家公务员录用考试《行测》真题（行政执法卷）", file:"bishi/xingce/2023年国家公务员录用考试《行测》真题（行政执法卷）.pdf", size:0.9 },
  { year:2022, cat:"行测", title:"2022+年国家公务员考试行测真题（地市级）", file:"bishi/xingce/2022+年国家公务员考试行测真题（地市级）.pdf", size:0.8 },
  { year:2022, cat:"行测", title:"2022年国家公务员考试《行测》真题（副省级)", file:"bishi/xingce/2022年国家公务员考试《行测》真题（副省级).pdf", size:1.0 },
  { year:2022, cat:"行测", title:"2022年国家公务员考试《行测》真题（行政执法）..", file:"bishi/xingce/2022年国家公务员考试《行测》真题（行政执法）...pdf", size:3.3 },
  { year:2026, cat:"申论", title:"2026年国家公务员录用考试《申论》题（行政执法卷）答案解析", file:"bishi/shenlun/2026年国家公务员录用考试《申论》题（行政执法卷）答案解析.pdf", size:0.8 },
  { year:2025, cat:"申论", title:"2025年国家公务员考试《申论》题（副省级）及参考答案", file:"bishi/shenlun/2025年国家公务员考试《申论》题（副省级）及参考答案.pdf", size:0.7 },
  { year:2025, cat:"申论", title:"2025年国家公考《申论》题+参考答案（地市级)", file:"bishi/shenlun/2025年国家公考《申论》题+参考答案（地市级).pdf", size:1.1 },
  { year:2025, cat:"申论", title:"2025年国家公考《申论》题+参考答案（行政执法)", file:"bishi/shenlun/2025年国家公考《申论》题+参考答案（行政执法).pdf", size:1.2 },
  { year:2024, cat:"申论", title:"2024年国考申论真题（副省级）及参考答案", file:"bishi/shenlun/2024年国考申论真题（副省级）及参考答案.pdf", size:1.2 },
  { year:2024, cat:"申论", title:"2024年国考申论真题（地市级）及参考答案", file:"bishi/shenlun/2024年国考申论真题（地市级）及参考答案.pdf", size:1.4 },
  { year:2024, cat:"申论", title:"2024年国考申论真题（行政执法卷）及参考答案", file:"bishi/shenlun/2024年国考申论真题（行政执法卷）及参考答案.pdf", size:1.1 },
  { year:2023, cat:"申论", title:"2023年国家公务员《申论》（行政执法卷）题和参考答案...", file:"bishi/shenlun/2023年国家公务员《申论》（行政执法卷）题和参考答案....pdf", size:0.4 },
  { year:2023, cat:"申论", title:"2023年国家公考《申论》（副省卷）题和参考答案...", file:"bishi/shenlun/2023年国家公考《申论》（副省卷）题和参考答案....pdf", size:0.6 },
  { year:2023, cat:"申论", title:"2023年国家公考《申论》（地市卷）题和参考答案...", file:"bishi/shenlun/2023年国家公考《申论》（地市卷）题和参考答案....pdf", size:0.4 },
  { year:2022, cat:"申论", title:"2022国考《申论》真题及答案解析（地市级）", file:"bishi/shenlun/2022国考《申论》真题及答案解析（地市级）.pdf", size:0.2 },
  { year:2022, cat:"申论", title:"2022年国家公务员考试申论试题（行政执法卷）及参考答案", file:"bishi/shenlun/2022年国家公务员考试申论试题（行政执法卷）及参考答案.pdf", size:0.4 },
  { year:2022, cat:"申论", title:"2022年国家公考《申论》真题（副省级）及参考答案", file:"bishi/shenlun/2022年国家公考《申论》真题（副省级）及参考答案.pdf", size:0.4 }
];
