import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const rows = [
  ["课程名称", "课程编号", "教师姓名", "实验室编号", "星期", "开始节次", "结束节次", "起始周", "结束周", "周类型"],
  ["数据结构与算法实验", "CS201", "王教授", "A203", "周日", 11, 12, 20, 20, "全"],
  ["计算机网络实验", "CS302", "刘老师", "B105", "周日", 11, 12, 20, 20, "全"],
  ["机器学习实验", "AI401", "陈教授", "B208", "周日", 11, 12, 20, 20, "全"],
  ["C语言程序设计实验", "CS105", "王教授", "A101", "周日", 9, 10, 20, 20, "全"],
  ["操作系统实验", "CS210", "刘老师", "C301", "周日", 9, 10, 20, 20, "全"],
];

const ws = XLSX.utils.aoa_to_sheet(rows);
ws["!cols"] = [
  { wch: 22 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 8 },
  { wch: 10 },
  { wch: 10 },
  { wch: 8 },
  { wch: 8 },
  { wch: 8 },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "本学期课程导入");

const notes = [
  ["使用说明"],
  ["1. 本模板针对演示账号数据（seed:demo）生成。"],
  ["2. 必须先在数据库存在课程、教师和实验室（课程归属教师需与导入教师姓名一致）。"],
  ["3. 若提示冲突，请先改周次/星期/节次后重试。"],
  ["4. 建议先使用 demo-labadmin 账号导入。"],
];
const noteWs = XLSX.utils.aoa_to_sheet(notes);
noteWs["!cols"] = [{ wch: 90 }];
XLSX.utils.book_append_sheet(wb, noteWs, "说明");

const outDir = path.resolve("docs", "samples");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.resolve(outDir, "course-import-sample.xlsx");
XLSX.writeFile(wb, outFile);

console.log(outFile);
