import "dotenv/config";
import * as db from "../server/db";

function isDuplicateError(error: any): boolean {
  return error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY";
}

async function safeCreate(action: () => Promise<any>) {
  try {
    await action();
    return true;
  } catch (error: any) {
    if (isDuplicateError(error)) return false;
    throw error;
  }
}

async function seed() {
  console.log("🌱 开始生成演示数据...\n");

  // 1) 用户（upsert，本身可重复执行）
  console.log("👤 创建用户...");
  await db.upsertUser({ openId: "demo-admin", name: "张伟（系统管理员）", email: "admin@demo.edu.cn", role: "sysAdmin", lastSignedIn: new Date() });
  await db.upsertUser({ openId: "demo-labadmin", name: "李娜（实验室管理员）", email: "labadmin@demo.edu.cn", role: "labAdmin", lastSignedIn: new Date() });
  await db.upsertUser({ openId: "demo-teacher-001", name: "王教授", email: "wang@demo.edu.cn", role: "teacher", lastSignedIn: new Date() });
  await db.upsertUser({ openId: "demo-teacher-002", name: "刘老师", email: "liu@demo.edu.cn", role: "teacher", lastSignedIn: new Date() });
  await db.upsertUser({ openId: "demo-teacher-003", name: "陈教授", email: "chen@demo.edu.cn", role: "teacher", lastSignedIn: new Date() });
  for (let i = 1; i <= 20; i++) {
    await db.upsertUser({
      openId: `demo-student-${String(i).padStart(3, "0")}`,
      name: `学生${i}`,
      email: `student${i}@demo.edu.cn`,
      role: "student",
      lastSignedIn: new Date(),
    });
  }
  console.log("  ✅ 用户已就绪\n");

  const admin = await db.getUserByOpenId("demo-admin");
  const labAdmin = await db.getUserByOpenId("demo-labadmin");
  const teacher1 = await db.getUserByOpenId("demo-teacher-001");
  const teacher2 = await db.getUserByOpenId("demo-teacher-002");
  const teacher3 = await db.getUserByOpenId("demo-teacher-003");

  if (!admin || !labAdmin || !teacher1 || !teacher2 || !teacher3) {
    throw new Error("核心演示账号创建失败，请检查 DATABASE_URL 与 users 表");
  }

  // 2) 学期 + 节次时间映射
  console.log("📅 创建学期与节次映射...");
  const semesterCreated = await safeCreate(() =>
    db.createSemester({
      semesterCode: "2025-2026-2",
      semesterName: "2025-2026学年第二学期",
      startDate: new Date("2026-02-23"),
      endDate: new Date("2026-07-05"),
      weekCount: 20,
      isCurrent: 1,
    })
  );
  // 若学期已存在（safeCreate 跳过），强制更新全部字段
  if (!semesterCreated) {
    const allSemesters = await db.getAllSemesters();
    const existing = allSemesters.find(s => s.semesterCode === "2025-2026-2");
    if (existing) {
      await db.updateSemester(existing.id, {
        semesterName: "2025-2026学年第二学期",
        startDate: new Date("2026-02-23"),
        endDate: new Date("2026-07-05"),
        weekCount: 20,
        isCurrent: 1,
      });
      console.log("  ℹ️ 已更新现有学期为当前学期（含日期）");
    }
  }

  // 12节次标准作息时间
  const periodMap = [
    { periodNo: 1, periodName: "第1节", startTime: "08:00", endTime: "08:45" },
    { periodNo: 2, periodName: "第2节", startTime: "08:55", endTime: "09:40" },
    { periodNo: 3, periodName: "第3节", startTime: "10:00", endTime: "10:45" },
    { periodNo: 4, periodName: "第4节", startTime: "10:55", endTime: "11:40" },
    { periodNo: 5, periodName: "第5节", startTime: "14:00", endTime: "14:45" },
    { periodNo: 6, periodName: "第6节", startTime: "14:55", endTime: "15:40" },
    { periodNo: 7, periodName: "第7节", startTime: "16:00", endTime: "16:45" },
    { periodNo: 8, periodName: "第8节", startTime: "16:55", endTime: "17:40" },
    { periodNo: 9, periodName: "第9节", startTime: "19:00", endTime: "19:45" },
    { periodNo: 10, periodName: "第10节", startTime: "19:55", endTime: "20:40" },
    { periodNo: 11, periodName: "第11节", startTime: "20:50", endTime: "21:35" },
    { periodNo: 12, periodName: "第12节", startTime: "21:40", endTime: "22:25" },
  ];
  let periodCount = 0;
  for (const p of periodMap) {
    if (await safeCreate(() => db.createPeriodTimeMapping(p))) periodCount++;
  }
  console.log(semesterCreated ? "  ✅ 学期已创建" : "  ℹ️ 学期已存在");
  console.log(`  ✅ 节次映射 ${periodCount}/12 条创建\n`);

  // 3) 实验室
  console.log("🏢 创建实验室...");
  const labs = [
    { roomNo: "A101", name: "计算机组成原理实验室", building: "A栋", location: "一楼东侧", capacity: 50, type: "计算机", managerId: labAdmin.id, openTimeStart: "08:00", openTimeEnd: "22:00", status: "enabled" as const, remark: "配备50台实验电脑" },
    { roomNo: "A203", name: "软件工程实验室", building: "A栋", location: "二楼西侧", capacity: 60, type: "计算机", managerId: labAdmin.id, openTimeStart: "08:00", openTimeEnd: "22:00", status: "enabled" as const, remark: "适合编程实验" },
    { roomNo: "B105", name: "网络技术实验室", building: "B栋", location: "一楼中央", capacity: 40, type: "网络", managerId: labAdmin.id, openTimeStart: "08:00", openTimeEnd: "18:00", status: "enabled" as const, remark: "网络设备齐全" },
    { roomNo: "B208", name: "人工智能实验室", building: "B栋", location: "二楼南侧", capacity: 45, type: "计算机", managerId: labAdmin.id, openTimeStart: "08:00", openTimeEnd: "22:00", status: "enabled" as const, remark: "支持深度学习" },
    { roomNo: "C301", name: "嵌入式系统实验室", building: "C栋", location: "三楼东侧", capacity: 30, type: "嵌入式", managerId: labAdmin.id, openTimeStart: "08:00", openTimeEnd: "18:00", status: "enabled" as const, remark: "ARM/单片机设备" },
  ];
  let createdLabCount = 0;
  for (const lab of labs) {
    if (await safeCreate(() => db.createLabRoom(lab))) createdLabCount++;
  }
  console.log(`  ✅ 新增实验室 ${createdLabCount} 个（其余已存在）\n`);

  const labA101 = await db.getLabRoomByNo("A101");
  const labA203 = await db.getLabRoomByNo("A203");
  const labB105 = await db.getLabRoomByNo("B105");
  const labB208 = await db.getLabRoomByNo("B208");

  if (!labA101 || !labA203 || !labB105 || !labB208) {
    throw new Error("实验室数据不完整，请检查 lab_rooms 表");
  }

  // 4) 规则
  console.log("📜 创建规则...");
  const rules = [
    { ruleCode: "MAX_ADVANCE_DAYS", ruleName: "最大提前预约天数", ruleValue: "7", description: "最多提前7天", status: "enabled" as const },
    { ruleCode: "MAX_DURATION_HOURS", ruleName: "单次预约最长时长", ruleValue: "4", description: "单次最长4小时", status: "enabled" as const },
    { ruleCode: "MAX_DAILY_RESERVATIONS", ruleName: "每日最大预约次数", ruleValue: "2", description: "每天最多2次", status: "enabled" as const },
  ];
  let createdRuleCount = 0;
  for (const rule of rules) {
    if (await safeCreate(() => db.createRule(rule))) createdRuleCount++;
  }
  console.log(`  ✅ 新增规则 ${createdRuleCount} 条（其余已存在）\n`);

  // 5) 课程、选课与排课
  console.log("📚 创建课程与排课...");
  const courseList = [
    { courseNo: "CS201", name: "数据结构与算法实验", teacherId: teacher1.id, description: "学习基本数据结构和算法设计方法", semester: "2025-2026-2", status: "active" as const },
    { courseNo: "CS302", name: "计算机网络实验", teacherId: teacher2.id, description: "学习网络协议和网络编程", semester: "2025-2026-2", status: "active" as const },
    { courseNo: "CS105", name: "C语言程序设计实验", teacherId: teacher1.id, description: "C语言基础编程实验", semester: "2025-2026-2", status: "active" as const },
    { courseNo: "CS210", name: "操作系统实验", teacherId: teacher2.id, description: "操作系统原理与Linux实验", semester: "2025-2026-2", status: "active" as const },
    { courseNo: "CS310", name: "数据库原理实验", teacherId: teacher3.id, description: "SQL编程与数据库设计实验", semester: "2025-2026-2", status: "active" as const },
    { courseNo: "AI401", name: "机器学习实验", teacherId: teacher3.id, description: "机器学习算法实现与训练", semester: "2025-2026-2", status: "active" as const },
    { courseNo: "CS220", name: "计算机组成原理实验", teacherId: teacher1.id, description: "CPU设计与汇编语言实验", semester: "2025-2026-2", status: "active" as const },
    { courseNo: "EE301", name: "嵌入式系统实验", teacherId: teacher2.id, description: "ARM/STM32开发实验", semester: "2025-2026-2", status: "active" as const },
  ];
  for (const c of courseList) {
    await safeCreate(() => db.createCourse(c));
  }

  // 获取所有课程
  const allCourses = await Promise.all(courseList.map(c => db.getCourseByNo(c.courseNo)));
  const validCourses = allCourses.filter(Boolean) as NonNullable<(typeof allCourses)[0]>[];

  // 选课：每门课分配不同学生群
  const studentGroups: Record<string, number[]> = {
    CS201: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    CS302: [10,11,12,13,14,15,16,17,18,19,20],
    CS105: [1,2,3,4,5,6,7,8,9,10],
    CS210: [5,6,7,8,9,10,11,12,13,14,15],
    CS310: [1,3,5,7,9,11,13,15,17,19],
    AI401: [8,9,10,11,12,16,17,18,19,20],
    CS220: [1,2,3,4,5,6,7,8,9,10,11,12],
    EE301: [13,14,15,16,17,18,19,20],
  };
  for (const course of validCourses) {
    const group = studentGroups[course.courseNo] || [];
    for (const i of group) {
      const student = await db.getUserByOpenId(`demo-student-${String(i).padStart(3, "0")}`);
      if (student) await safeCreate(() => db.addStudentToCourse(course.id, student.id));
    }
  }

  // 排课：真实覆盖——同一时间段多个实验室同时上课
  // teacher1(王教授): CS201, CS105, CS220
  // teacher2(刘老师): CS302, CS210, EE301
  // teacher3(陈教授): CS310, AI401
  const scheduleData: { courseNo: string; labNo: string; dayOfWeek: number; startPeriod: number; endPeriod: number; startWeek: number; endWeek: number; weekType?: string }[] = [
    // ═══════ 周一 ═══════
    // 1-2节：3个实验室同时上课
    { courseNo: "CS220", labNo: "A101", dayOfWeek: 1, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 },
    { courseNo: "CS302", labNo: "B105", dayOfWeek: 1, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 18 },
    { courseNo: "AI401", labNo: "B208", dayOfWeek: 1, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 },
    // 3-4节：2个实验室同时
    { courseNo: "CS201", labNo: "A203", dayOfWeek: 1, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 18 },
    { courseNo: "CS210", labNo: "B105", dayOfWeek: 1, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 },
    // 5-6节：3个实验室同时
    { courseNo: "CS105", labNo: "A101", dayOfWeek: 1, startPeriod: 5, endPeriod: 6, startWeek: 1, endWeek: 14 },
    { courseNo: "EE301", labNo: "C301", dayOfWeek: 1, startPeriod: 5, endPeriod: 6, startWeek: 1, endWeek: 16 },
    { courseNo: "CS310", labNo: "A203", dayOfWeek: 1, startPeriod: 5, endPeriod: 6, startWeek: 1, endWeek: 16 },

    // ═══════ 周二 ═══════
    // 1-2节：3个实验室同时
    { courseNo: "CS220", labNo: "A101", dayOfWeek: 2, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 },
    { courseNo: "CS302", labNo: "B105", dayOfWeek: 2, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 18 },
    { courseNo: "CS310", labNo: "B208", dayOfWeek: 2, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 },
    // 3-4节：3个实验室同时
    { courseNo: "CS201", labNo: "A203", dayOfWeek: 2, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 18 },
    { courseNo: "CS210", labNo: "B105", dayOfWeek: 2, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 },
    { courseNo: "AI401", labNo: "B208", dayOfWeek: 2, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 },
    // 5-8节：C301连排4课时（嵌入式系统）
    { courseNo: "EE301", labNo: "C301", dayOfWeek: 2, startPeriod: 5, endPeriod: 8, startWeek: 1, endWeek: 16 },
    // 7-8节：A203同时有课（与C301的5-8节重叠）
    { courseNo: "CS310", labNo: "A203", dayOfWeek: 2, startPeriod: 7, endPeriod: 8, startWeek: 1, endWeek: 16 },

    // ═══════ 周三 ═══════
    // 1-2节：2个实验室同时
    { courseNo: "CS220", labNo: "A101", dayOfWeek: 3, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 },
    { courseNo: "CS302", labNo: "B105", dayOfWeek: 3, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 18 },
    // 3-4节：3个实验室同时（AI401单周）
    { courseNo: "CS201", labNo: "A203", dayOfWeek: 3, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 18 },
    { courseNo: "CS210", labNo: "B105", dayOfWeek: 3, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 },
    { courseNo: "AI401", labNo: "B208", dayOfWeek: 3, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16, weekType: "odd" },
    // 5-6节：2个实验室同时
    { courseNo: "CS105", labNo: "A101", dayOfWeek: 3, startPeriod: 5, endPeriod: 6, startWeek: 1, endWeek: 14 },
    { courseNo: "EE301", labNo: "C301", dayOfWeek: 3, startPeriod: 5, endPeriod: 6, startWeek: 1, endWeek: 16 },
    // 7-8节
    { courseNo: "CS310", labNo: "A203", dayOfWeek: 3, startPeriod: 7, endPeriod: 8, startWeek: 1, endWeek: 16 },

    // ═══════ 周四 ═══════
    // 1-2节：3个实验室同时（AI401双周）
    { courseNo: "CS220", labNo: "A101", dayOfWeek: 4, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 },
    { courseNo: "CS210", labNo: "B105", dayOfWeek: 4, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 },
    { courseNo: "AI401", labNo: "B208", dayOfWeek: 4, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16, weekType: "even" },
    // 3-4节：3个实验室同时
    { courseNo: "CS201", labNo: "A203", dayOfWeek: 4, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 18 },
    { courseNo: "CS302", labNo: "B105", dayOfWeek: 4, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 18 },
    { courseNo: "CS310", labNo: "B208", dayOfWeek: 4, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 },
    // 5-6节：2个实验室同时
    { courseNo: "CS105", labNo: "A101", dayOfWeek: 4, startPeriod: 5, endPeriod: 6, startWeek: 1, endWeek: 14 },
    { courseNo: "EE301", labNo: "C301", dayOfWeek: 4, startPeriod: 5, endPeriod: 6, startWeek: 1, endWeek: 16 },
    // 7-8节
    { courseNo: "CS310", labNo: "A203", dayOfWeek: 4, startPeriod: 7, endPeriod: 8, startWeek: 1, endWeek: 16 },

    // ═══════ 周五 ═══════
    // 1-2节：3个实验室同时
    { courseNo: "CS105", labNo: "A101", dayOfWeek: 5, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 14 },
    { courseNo: "CS302", labNo: "B105", dayOfWeek: 5, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 18 },
    { courseNo: "AI401", labNo: "B208", dayOfWeek: 5, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16 },
    // 3-4节：3个实验室同时
    { courseNo: "CS201", labNo: "A203", dayOfWeek: 5, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 18 },
    { courseNo: "CS210", labNo: "B105", dayOfWeek: 5, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 },
    { courseNo: "CS310", labNo: "B208", dayOfWeek: 5, startPeriod: 3, endPeriod: 4, startWeek: 1, endWeek: 16 },
    // 5-6节：2个实验室同时
    { courseNo: "CS220", labNo: "A101", dayOfWeek: 5, startPeriod: 5, endPeriod: 6, startWeek: 1, endWeek: 16 },
    { courseNo: "EE301", labNo: "C301", dayOfWeek: 5, startPeriod: 5, endPeriod: 6, startWeek: 1, endWeek: 16 },
  ];

  // 准备实验室 ID 映射
  const labC301 = await db.getLabRoomByNo("C301");
  const labMap: Record<string, number> = {
    A101: labA101.id, A203: labA203.id, B105: labB105.id, B208: labB208.id,
    ...(labC301 ? { C301: labC301.id } : {}),
  };
  const courseMap: Record<string, number> = {};
  for (const c of validCourses) courseMap[c.courseNo] = c.id;

  let scheduleCount = 0;
  for (const s of scheduleData) {
    const courseId = courseMap[s.courseNo];
    const labId = labMap[s.labNo];
    if (!courseId || !labId) continue;
    if (await safeCreate(() =>
      db.addCourseSchedule({
        courseId, labId,
        dayOfWeek: s.dayOfWeek,
        startPeriod: s.startPeriod,
        endPeriod: s.endPeriod,
        startWeek: s.startWeek,
        endWeek: s.endWeek,
        weekType: (s as any).weekType || "all",
        status: "approved",
        approvedAt: new Date(),
        approvedBy: admin.id,
      })
    )) scheduleCount++;
  }
  console.log(`  ✅ ${validCourses.length} 门课程, ${scheduleCount} 条排课已就绪\n`);

  // 6) 设备
  console.log("🖥️ 创建设备...");
  const allDemoLabs = [labA101, labA203, labB105, labB208, labC301].filter(Boolean) as NonNullable<typeof labA101>[];
  const deviceTemplates = [
    { suffix: "PC", name: "实验电脑", type: "台式电脑", count: 3 },
    { suffix: "SW", name: "网络交换机", type: "网络设备", count: 2 },
    { suffix: "SV", name: "GPU服务器", type: "服务器", count: 1 },
    { suffix: "PR", name: "投影仪", type: "显示设备", count: 1 },
  ];
  let deviceCount = 0;
  for (const lab of allDemoLabs) {
    for (const tmpl of deviceTemplates) {
      for (let i = 1; i <= tmpl.count; i++) {
        if (await safeCreate(() => db.createDevice({
          labId: lab.id,
          deviceNo: `${lab.roomNo}-${tmpl.suffix}-${String(i).padStart(2, "0")}`,
          name: `${lab.name}${tmpl.name}${i}`,
          type: tmpl.type,
          status: "available",
          description: `${lab.name}配备的${tmpl.name}`,
        }))) deviceCount++;
      }
    }
  }
  console.log(`  ✅ 新增设备 ${deviceCount} 台\n`);

  // 7) 丰富的预约记录 —— 关键：为 demo-student-001 构建历史偏好
  console.log("🗓️ 创建丰富预约数据...");
  const students: NonNullable<Awaited<ReturnType<typeof db.getUserByOpenId>>>[] = [];
  for (let i = 1; i <= 20; i++) {
    const s = await db.getUserByOpenId(`demo-student-${String(i).padStart(3, "0")}`);
    if (s) students.push(s);
  }

  const now = new Date();
  let reservationCount = 0;

  // 7a) demo-student-001 的历史预约（过去已完成） — 偏好 A栋计算机类
  const student1 = students[0];
  const pastDays = [3, 5, 7, 10, 14, 18, 21];
  for (const daysAgo of pastDays) {
    const start = new Date(now);
    start.setDate(start.getDate() - daysAgo);
    start.setHours(14, 0, 0, 0);
    const end = new Date(start);
    end.setHours(16, 0, 0, 0);
    // 主要去 A101 和 A203（计算机 + A栋）
    const targetLab = daysAgo % 2 === 0 ? labA101 : labA203;
    await db.createReservation({
      labId: targetLab.id,
      userId: student1.id,
      title: ["课程实验", "编程练习", "项目开发", "数据结构上机", "算法竞赛练习", "软工实验", "系统测试"][reservationCount % 7],
      reason: "课程学习需要",
      peopleCount: [3, 5, 8, 2, 4, 6, 10][reservationCount % 7],
      startTime: start,
      endTime: end,
      status: "completed",
      applyTime: new Date(start.getTime() - 2 * 86400000),
      approveTime: new Date(start.getTime() - 86400000),
    });
    reservationCount++;
  }

  // 7b) 其他学生分散到各实验室的预约 — 制造负载差异
  const statusPool: ("pending" | "approved" | "completed" | "rejected" | "cancelled")[] = ["pending", "approved", "completed", "completed", "approved"];
  for (let i = 1; i < Math.min(students.length, 15); i++) {
    const s = students[i];
    // 每个学生1~3条预约
    const count = (i % 3) + 1;
    for (let j = 0; j < count; j++) {
      const daysOffset = (j === 0) ? 1 : (j === 1) ? -(i % 5 + 1) : 3;
      const start = new Date(now);
      start.setDate(start.getDate() + daysOffset);
      start.setHours(8 + (i + j * 2) % 12, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 2, 0, 0, 0);
      // 分散到不同实验室；让 B208 负载偏高（热门实验室）
      const labIndex = (i < 5) ? 3 : i % allDemoLabs.length; // 前几个学生都去B208
      const targetLab = allDemoLabs[labIndex];
      const status = daysOffset < 0 ? "completed" : statusPool[j % statusPool.length];
      await db.createReservation({
        labId: targetLab.id,
        userId: s.id,
        title: [`机器学习实验`, `网络配置实验`, `嵌入式开发`, `数据库实验`, `Web开发实验`][i % 5],
        reason: ["课程作业", "项目需要", "毕业设计", "竞赛准备", "兴趣探索"][j % 5],
        peopleCount: [1, 3, 5, 8, 15][i % 5],
        startTime: start,
        endTime: end,
        status,
        applyTime: new Date(start.getTime() - 2 * 86400000),
        approveTime: status !== "pending" ? new Date(start.getTime() - 86400000) : undefined,
      });
      reservationCount++;
    }
  }

  // 7c) 明天在 B208 制造冲突（让推荐时空闲度形成对比）
  const tomorrow14 = new Date(now);
  tomorrow14.setDate(tomorrow14.getDate() + 1);
  tomorrow14.setHours(14, 0, 0, 0);
  const tomorrow16 = new Date(tomorrow14);
  tomorrow16.setHours(16, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    const s = students[i + 5] || students[0];
    await db.createReservation({
      labId: labB208.id,
      userId: s.id,
      title: `AI实验室使用-${i + 1}`,
      reason: "深度学习项目",
      peopleCount: 5,
      startTime: tomorrow14,
      endTime: tomorrow16,
      status: i === 0 ? "approved" : "pending",
      applyTime: new Date(),
    });
    reservationCount++;
  }

  console.log(`  ✅ 创建预约 ${reservationCount} 条\n`);

  // 8) 通知
  console.log("🔔 创建通知...");
  let notifCount = 0;
  const notifications = [
    { userId: student1.id, type: "reservation_approved" as const, title: "预约已通过", content: "您在A101的预约已通过审核，请按时到达。" },
    { userId: student1.id, type: "system" as const, title: "系统更新通知", content: "实验室预约系统已升级至v2.0，新增智能推荐功能。" },
    { userId: student1.id, type: "reservation_reminder" as const, title: "预约提醒", content: "您明天14:00在计算机组成原理实验室有预约，请准时签到。" },
    { userId: students[1]?.id || student1.id, type: "reservation_rejected" as const, title: "预约被驳回", content: "您在B105的预约因时间冲突被驳回，建议选择其他时段。" },
  ];
  for (const n of notifications) {
    if (await safeCreate(() => db.createNotification(n))) notifCount++;
  }
  console.log(`  ✅ 创建通知 ${notifCount} 条\n`);

  // 9) 审计日志
  console.log("📋 创建审计日志...");
  let auditCount = 0;
  const auditLogs = [
    { operatorUserId: admin.id, operationType: "user_role_change", targetType: "user", details: '{"from":"student","to":"labAdmin"}', result: "success" as const },
    { operatorUserId: labAdmin.id, operationType: "reservation_approve", targetType: "reservation", details: '{"labId":' + labA101.id + '}', result: "success" as const },
    { operatorUserId: labAdmin.id, operationType: "lab_create", targetType: "lab_room", details: '{"roomNo":"A101"}', result: "success" as const },
    { operatorUserId: admin.id, operationType: "rule_update", targetType: "rule", details: '{"ruleCode":"MAX_ADVANCE_DAYS","newValue":"7"}', result: "success" as const },
    { operatorUserId: labAdmin.id, operationType: "device_create", targetType: "device", details: '{"count":35}', result: "success" as const },
  ];
  for (const log of auditLogs) {
    if (await safeCreate(() => db.createAuditLog(log))) auditCount++;
  }
  console.log(`  ✅ 创建审计日志 ${auditCount} 条\n`);

  // 10) 违约记录与黑名单
  console.log("⚠️ 创建违约记录...");
  const violationStudents = students.slice(0, 5); // 前5个学生有违约记录
  const violationData = [
    // student-001: 2次违约，共7分（未到黑名单阈值10分）
    { userId: violationStudents[0].id, violationType: "no_show" as const, points: 5, description: "预约A101但未签到" },
    { userId: violationStudents[0].id, violationType: "late_cancel" as const, points: 2, description: "开始前30分钟取消B201预约" },
    // student-002: 3次违约，共10分（触发黑名单）
    { userId: violationStudents[1].id, violationType: "no_show" as const, points: 5, description: "物理实验预约未签到" },
    { userId: violationStudents[1].id, violationType: "timeout_checkout" as const, points: 3, description: "超时占用A102实验室" },
    { userId: violationStudents[1].id, violationType: "late_cancel" as const, points: 2, description: "临时取消化学实验预约" },
    // student-003: 1次违约，3分
    { userId: violationStudents[2].id, violationType: "timeout_checkout" as const, points: 3, description: "B201签退超时40分钟" },
    // student-004: 手动记录1次，1分
    { userId: violationStudents[3].id, violationType: "manual_record" as const, points: 1, description: "未经允许移动实验设备" },
    // student-005: 1次no_show，5分
    { userId: violationStudents[4].id, violationType: "no_show" as const, points: 5, description: "数据结构实验课缺席" },
  ];
  let violationCount = 0;
  for (const v of violationData) {
    if (await safeCreate(() => db.recordViolation(v))) violationCount++;
  }
  console.log(`  ✅ 创建违约记录 ${violationCount} 条（student-002 累计10分，已自动进入黑名单）\n`);

  console.log("🎉 演示数据生成完成！");
  console.log(`   📊 总结：${students.length + 4} 用户 / ${allDemoLabs.length} 实验室 / ${validCourses.length} 课程 / ${scheduleCount} 排课 / ${deviceCount} 设备 / ${reservationCount} 预约`);
  console.log("   🔑 账号：demo-admin / demo-labadmin / demo-teacher-001 / demo-student-001");
  console.log("   💡 演示提示：管理员查看课表视图，教师管理课程排课");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ 数据生成失败:", error);
    process.exit(1);
  });
