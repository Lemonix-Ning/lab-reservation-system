/**
 * Demo 完整流程检查脚本
 * 以评委视角遍历每个角色的核心功能，输出问题清单
 */
import "dotenv/config";
import * as db from "../server/db";

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️";
const issues: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ${PASS} ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`  ${FAIL} ${name}${detail ? ` — ${detail}` : ""}`);
    issues.push(`${name}: ${detail || "失败"}`);
  }
}

function warn(name: string, detail: string) {
  console.log(`  ${WARN} ${name} — ${detail}`);
  issues.push(`[警告] ${name}: ${detail}`);
}

async function main() {
  console.log("\n🔍 开始 Demo 完整流程检查\n");

  // ==================== 1. 基础数据完整性 ====================
  console.log("══════ 1. 基础数据完整性 ══════");
  
  const semester = await db.getCurrentSemester();
  check("当前学期存在", !!semester);
  if (semester) {
    const sd = semester.startDate;
    const valid = !!sd && !isNaN(new Date(sd).getTime());
    check("学期 startDate 有效", valid, `startDate=${sd}`);
    check("学期 isCurrent=1", semester.isCurrent === 1);
    check("学期 weekCount > 0", (semester.weekCount || 0) > 0, `weekCount=${semester.weekCount}`);
  }

  const periods = await db.getPeriodTimeMapping();
  check("节次映射存在 (>=8)", periods.length >= 8, `count=${periods.length}`);

  const labs = await db.getAllLabRooms();
  const enabledLabs = labs.filter(l => l.status === "enabled");
  check("启用实验室 >= 3", enabledLabs.length >= 3, `enabled=${enabledLabs.length}, total=${labs.length}`);

  const allSchedules = await db.getAllApprovedSchedules();
  check("排课数据 >= 20", allSchedules.length >= 20, `count=${allSchedules.length}`);

  const scheduledLabIds = [...new Set(allSchedules.map(s => s.labId))];
  const labIdsInList = enabledLabs.map(l => l.id);
  const orphanLabs = scheduledLabIds.filter(id => !labIdsInList.includes(id));
  check("排课实验室都在列表中", orphanLabs.length === 0, 
    orphanLabs.length > 0 ? `孤立labId: ${orphanLabs.join(",")}` : "全部匹配");

  // 周次计算
  if (semester?.startDate) {
    const now = new Date();
    const start = new Date(semester.startDate);
    const diff = now.getTime() - start.getTime();
    const currentWeek = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
    check("当前周次合理 (1-20)", currentWeek >= 1 && currentWeek <= 20, `week=${currentWeek}`);
    
    const thisWeekSchedules = allSchedules.filter((s: any) => {
      if (currentWeek < (s.startWeek || 1) || currentWeek > (s.endWeek || 20)) return false;
      if (s.weekType === "odd" && currentWeek % 2 === 0) return false;
      if (s.weekType === "even" && currentWeek % 2 !== 0) return false;
      return true;
    });
    check("本周有排课数据 (>=10)", thisWeekSchedules.length >= 10, `count=${thisWeekSchedules.length}`);
  }

  // ==================== 2. 用户角色 ====================
  console.log("\n══════ 2. 用户账号 ══════");
  
  const admin = await db.getUserByOpenId("demo-admin");
  check("系统管理员", !!admin && admin.role === "sysAdmin", admin ? `${admin.name}` : "不存在");
  
  const labAdmin = await db.getUserByOpenId("demo-labadmin");
  check("实验室管理员", !!labAdmin && labAdmin.role === "labAdmin", labAdmin ? `${labAdmin.name}` : "不存在");
  
  const teacher1 = await db.getUserByOpenId("demo-teacher-001");
  check("教师", !!teacher1 && teacher1.role === "teacher", teacher1 ? `${teacher1.name}` : "不存在");
  
  const student1 = await db.getUserByOpenId("demo-student-001");
  check("学生", !!student1 && student1.role === "student", student1 ? `${student1.name}` : "不存在");

  // ==================== 3. 学生视角 ====================
  console.log("\n══════ 3. 学生视角 ══════");
  
  if (student1) {
    const myCourses = await db.getStudentCourses(student1.id);
    check("已选课程 >= 3", myCourses.length >= 3, `count=${myCourses.length}`);
    
    const myReservations = await db.getUserReservations(student1.id);
    check("有预约记录 >= 3", myReservations.length >= 3, `count=${myReservations.length}`);
    
    const myNotifications = await db.getUserNotifications(student1.id);
    check("有通知消息", myNotifications.length >= 1, `count=${myNotifications.length}`);
    
    const myViolations = await db.getUserViolations(student1.id);
    check("有违约记录(展示用)", myViolations.length >= 1, `count=${myViolations.length}`);
    
    const violationPoints = await db.getUserTotalViolationPoints(student1.id);
    check("违约积分合理", violationPoints >= 1, `points=${violationPoints}`);
  }

  // ==================== 4. 教师视角 ====================
  console.log("\n══════ 4. 教师视角 ══════");
  
  if (teacher1) {
    const teacherCourses = await db.getCoursesByTeacherId(teacher1.id);
    check("教师有课程 >= 2", teacherCourses.length >= 2, 
      teacherCourses.map(c => c.name).join(", "));
    
    if (teacherCourses.length > 0) {
      const schedules = await db.getCourseSchedules(teacherCourses[0].id);
      check("课程有排课", schedules.length >= 1, 
        `${teacherCourses[0].name}: ${schedules.length}个时段`);
      
      const students = await db.getCourseStudents(teacherCourses[0].id);
      check("课程有学生 >= 3", students.length >= 3, 
        `${teacherCourses[0].name}: ${students.length}人`);
    }
  }

  // ==================== 5. 管理员视角 ====================
  console.log("\n══════ 5. 管理员视角 ══════");
  
  const devices = await db.getAllDevices();
  check("有设备数据 >= 10", devices.length >= 10, `count=${devices.length}`);
  
  const rules = await db.getAllRules();
  check("有规则配置 >= 2", rules.length >= 2, `count=${rules.length}`);
  
  try {
    const auditLogs = await db.getAuditLogs({ limit: 10, offset: 0 });
    const logCount = (auditLogs as any)?.data?.length ?? (auditLogs as any)?.length ?? 0;
    check("有审计日志", logCount >= 1, `count=${logCount}`);
  } catch (err: any) {
    check("审计日志查询", false, err.message);
  }

  // ==================== 6. 数据一致性 ====================
  console.log("\n══════ 6. 数据一致性 ══════");
  
  const nullTeachers = allSchedules.filter((s: any) => !s.teacherName);
  check("排课教师名非空", nullTeachers.length === 0, 
    nullTeachers.length > 0 ? `${nullTeachers.length}条无教师名` : "全部有值");

  const nullLabs = allSchedules.filter((s: any) => !s.labName);
  check("排课实验室名非空", nullLabs.length === 0,
    nullLabs.length > 0 ? `${nullLabs.length}条无实验室名` : "全部有值");

  const nullCourseNames = allSchedules.filter((s: any) => !s.courseName);
  check("排课课程名非空", nullCourseNames.length === 0,
    nullCourseNames.length > 0 ? `${nullCourseNames.length}条无课程名` : "全部有值");

  // 检查排课中是否有重复记录
  const scheduleKeys = allSchedules.map((s: any) => 
    `${s.courseId}-${s.labId}-${s.dayOfWeek}-${s.startPeriod}-${s.endPeriod}-${s.startWeek}-${s.endWeek}-${s.weekType}`
  );
  const uniqueKeys = new Set(scheduleKeys);
  check("无重复排课", scheduleKeys.length === uniqueKeys.size, 
    scheduleKeys.length !== uniqueKeys.size 
      ? `${scheduleKeys.length - uniqueKeys.size}条重复` 
      : `共${scheduleKeys.length}条，全部唯一`);

  // ==================== 7. 3L 智能推荐检查 ====================
  console.log("\n══════ 7. 3L 智能推荐算法 ══════");
  
  if (student1) {
    const recs = await db.getLabRecommendations(student1.id, 10);
    check("推荐结果非空", recs.length >= 3, `返回${recs.length}个实验室`);
    
    const hasLabScore = recs.some(r => r.labScore > 0);
    check("Lab 适配度维度生效", hasLabScore);
    
    const hasLoadScore = recs.some(r => r.loadScore > 0);
    check("Load 负载维度生效", hasLoadScore);
    
    const hasLikeScore = recs.some(r => r.likeScore > 0);
    check("Like 偏好维度生效", hasLikeScore);
    
    const hasTags = recs.some(r => r.tags.length > 0);
    check("推荐标签生成", hasTags);
    
    const sorted = recs.every((r, i) => i === 0 || r.totalScore <= recs[i-1].totalScore);
    check("按综合得分降序排列", sorted);
    
    if (recs.length > 0) {
      const top = recs[0];
      check("Top1 推荐合理", top.totalScore >= 50, 
        `${top.labName} ${top.totalScore}分 [${top.tags.join(",")}]`);
    }
  }

  // ==================== 总结 ====================
  console.log("\n══════════════════════════════════");
  const errors = issues.filter(i => !i.startsWith("[警告]"));
  const warnings = issues.filter(i => i.startsWith("[警告]"));
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log("🎉 全部通过！Demo 数据状态完好。\n");
  } else {
    if (errors.length > 0) {
      console.log(`\n❌ ${errors.length} 个错误：`);
      errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }
    if (warnings.length > 0) {
      console.log(`\n⚠️ ${warnings.length} 个警告：`);
      warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
    }
    console.log("");
  }

  process.exit(0);
}

main().catch(err => {
  console.error("脚本执行失败:", err);
  process.exit(1);
});
