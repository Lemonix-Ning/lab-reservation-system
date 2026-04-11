import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import * as db from "../server/db";

type WeekType = "all" | "odd" | "even";

type PlannedRow = {
  courseName: string;
  courseNo: string;
  teacherName: string;
  labRoomNo: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  weekStart: number;
  weekEnd: number;
  weekType: WeekType;
};

const DAY_NAME: Record<number, string> = {
  1: "周一",
  2: "周二",
  3: "周三",
  4: "周四",
  5: "周五",
  6: "周六",
  7: "周日",
};

const PERIOD_BLOCKS: Array<[number, number]> = [
  [11, 12],
  [9, 10],
  [7, 8],
  [5, 6],
  [3, 4],
  [1, 2],
];

const WEEK_CANDIDATES = [20, 19, 18, 17, 16, 15, 14, 13, 12];
const DAY_CANDIDATES = [7, 6, 5, 4, 3, 2, 1];
const DEMO_COURSE_NOS = new Set(["CS201", "CS302", "CS105", "CS210", "CS310", "AI401", "CS220", "EE301"]);

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart <= bEnd && bStart <= aEnd;
}

function hasPlannedConflict(planned: PlannedRow[], candidate: PlannedRow) {
  return planned.some((row) => {
    if (row.labRoomNo !== candidate.labRoomNo) return false;
    if (row.dayOfWeek !== candidate.dayOfWeek) return false;
    if (!overlaps(row.weekStart, row.weekEnd, candidate.weekStart, candidate.weekEnd)) return false;
    if (row.weekType !== "all" && candidate.weekType !== "all" && row.weekType !== candidate.weekType) return false;
    return overlaps(row.startPeriod, row.endPeriod, candidate.startPeriod, candidate.endPeriod);
  });
}

async function pickFreeSlot(
  planned: PlannedRow[],
  labNos: string[],
): Promise<Pick<PlannedRow, "labRoomNo" | "dayOfWeek" | "startPeriod" | "endPeriod" | "weekStart" | "weekEnd" | "weekType">> {
  for (const week of WEEK_CANDIDATES) {
    for (const day of DAY_CANDIDATES) {
      for (const [startPeriod, endPeriod] of PERIOD_BLOCKS) {
        for (const labNo of labNos) {
          const lab = await db.getLabRoomByNo(labNo);
          if (!lab) continue;

          const candidate: PlannedRow = {
            courseName: "",
            courseNo: "",
            teacherName: "",
            labRoomNo: labNo,
            dayOfWeek: day,
            startPeriod,
            endPeriod,
            weekStart: week,
            weekEnd: week,
            weekType: "all",
          };

          if (hasPlannedConflict(planned, candidate)) continue;

          const scheduleConflicts = await db.checkScheduleConflict({
            labId: lab.id,
            dayOfWeek: day,
            startPeriod,
            endPeriod,
            startWeek: week,
            endWeek: week,
            weekType: "all",
          });
          if (scheduleConflicts.length > 0) continue;

          const reservationConflicts = await db.checkScheduleConflictWithReservation({
            labId: lab.id,
            dayOfWeek: day,
            startPeriod,
            endPeriod,
            startWeek: week,
            endWeek: week,
            weekType: "all",
          });
          if (reservationConflicts.hasConflict) continue;

          return {
            labRoomNo: labNo,
            dayOfWeek: day,
            startPeriod,
            endPeriod,
            weekStart: week,
            weekEnd: week,
            weekType: "all",
          };
        }
      }
    }
  }

  throw new Error("未找到可用的无冲突时段，请先清理已有排课/预约后重试");
}

async function main() {
  const demoTeacherOpenIds = ["demo-teacher-001", "demo-teacher-002", "demo-teacher-003"];
  const teachers = (
    await Promise.all(demoTeacherOpenIds.map((openId) => db.getUserByOpenId(openId)))
  ).filter((t): t is NonNullable<Awaited<ReturnType<typeof db.getUserByOpenId>>> => !!t);

  if (teachers.length === 0) {
    throw new Error("未找到演示教师账号，请先执行 pnpm seed:demo");
  }

  const labs = (await db.getAllLabRooms()).filter((l) => l.status === "enabled");
  if (labs.length === 0) {
    throw new Error("未找到可用实验室，请先准备演示实验室数据");
  }

  const labNos = labs.map((l) => l.roomNo);
  const selectedCourses: Array<{ courseNo: string; courseName: string; teacherName: string; studentCount: number }> = [];

  for (const teacher of teachers) {
    const courses = await db.getCoursesByTeacherId(teacher.id);
    for (const course of courses) {
      if (!DEMO_COURSE_NOS.has(course.courseNo)) continue;
      const students = await db.getCourseStudents(course.id);
      if (students.length === 0) continue;
      selectedCourses.push({
        courseNo: course.courseNo,
        courseName: course.name,
        teacherName: teacher.name,
        studentCount: students.length,
      });
    }
  }

  if (selectedCourses.length === 0) {
    throw new Error("未找到包含演示学生的演示教师课程，请先执行 pnpm seed:demo");
  }

  // 每个演示教师至少一门课，最多导出 6 门，便于一次导入验证
  const dedup = new Map<string, { courseNo: string; courseName: string; teacherName: string; studentCount: number }>();
  for (const c of selectedCourses) {
    const key = `${c.teacherName}::${c.courseNo}`;
    if (!dedup.has(key)) dedup.set(key, c);
  }
  const coursesForImport = Array.from(dedup.values()).slice(0, 6);

  const planned: PlannedRow[] = [];
  for (const course of coursesForImport) {
    const slot = await pickFreeSlot(planned, labNos);
    planned.push({
      courseName: course.courseName,
      courseNo: course.courseNo,
      teacherName: course.teacherName,
      ...slot,
    });
  }

  const rows = [
    ["课程名称", "课程编号", "教师姓名", "实验室编号", "星期", "开始节次", "结束节次", "起始周", "结束周", "周类型"],
    ...planned.map((p) => [
      p.courseName,
      p.courseNo,
      p.teacherName,
      p.labRoomNo,
      DAY_NAME[p.dayOfWeek],
      p.startPeriod,
      p.endPeriod,
      p.weekStart,
      p.weekEnd,
      "全",
    ]),
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
  XLSX.utils.book_append_sheet(wb, ws, "可成功导入-演示教师");

  const notes = [
    ["说明"],
    ["1. 此文件根据当前数据库实时生成，课程均属于演示教师账号。"],
    ["2. 已筛选有演示学生的课程，教师登录后可直接看到课程与关联学生。"],
    ["3. 时段已避开当前排课/个人预约冲突，可直接导入验证。"],
    ["4. 若导入前后数据库发生变化，请重新运行本脚本生成新文件。"],
  ];
  const noteWs = XLSX.utils.aoa_to_sheet(notes);
  noteWs["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, noteWs, "说明");

  const outDir = path.resolve("docs", "samples");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.resolve(outDir, "course-import-demo-success.xlsx");
  XLSX.writeFile(wb, outFile);

  console.log(outFile);
  console.log("\n导入课程预览:");
  for (const c of coursesForImport) {
    console.log(`- ${c.courseNo} ${c.courseName} / ${c.teacherName} / 学生${c.studentCount}人`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
