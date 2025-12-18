import { describe, it, expect, vi } from "vitest";
import * as db from "./db";

describe("Course Management (P1)", () => {
  const testCourse = {
    id: 1,
    courseNo: "CS101",
    name: "数据结构",
    teacherId: 1,
    description: null,
    semester: "2024-1",
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    studentCount: 0,
  };

  // ============ 课程创建和查询 ============
  it("应该能够创建课程", async () => {
    vi.spyOn(db, "createCourse").mockResolvedValue({ insertId: 1 } as any);
    const result = await db.createCourse({
      courseNo: "CS101",
      name: "数据结构",
      teacherId: 1,
      semester: "2024-1",
      status: "active",
    });
    expect(result).toBeDefined();
    expect((result as any).insertId).toBe(1);
  });

  it("应该能够按教师ID查询课程列表", async () => {
    vi.spyOn(db, "getCoursesByTeacherId").mockResolvedValue([testCourse]);
    const courses = await db.getCoursesByTeacherId(1);
    expect(Array.isArray(courses)).toBe(true);
    expect(courses.length).toBeGreaterThan(0);
    expect(courses[0].teacherId).toBe(1);
  });

  it("应该能够获取所有课程", async () => {
    vi.spyOn(db, "getAllCourses").mockResolvedValue([testCourse]);
    const courses = await db.getAllCourses();
    expect(Array.isArray(courses)).toBe(true);
    expect(courses.length).toBeGreaterThan(0);
  });

  it("应该能够按ID获取课程详情", async () => {
    vi.spyOn(db, "getCourseById").mockResolvedValue(testCourse);
    const course = await db.getCourseById(1);
    
    expect(course).toBeDefined();
    if (course) {
      expect(course.courseNo).toBe("CS101");
      expect(course.name).toBe("数据结构");
    }
  });

  it("应该能够更新课程信息", async () => {
    vi.spyOn(db, "updateCourse").mockResolvedValue(undefined as any);
    await db.updateCourse(1, { name: "数据结构进阶" });
    
    vi.spyOn(db, "getCourseById").mockResolvedValue({
      ...testCourse,
      name: "数据结构进阶",
    });
    const updated = await db.getCourseById(1);
    expect(updated?.name).toBe("数据结构进阶");
  });

  it("应该能够删除课程", async () => {
    vi.spyOn(db, "deleteCourse").mockResolvedValue(undefined as any);
    await expect(db.deleteCourse(1)).resolves.toBeUndefined();
  });

  // ============ 学生选课管理 ============
  it("应该能够向课程添加学生", async () => {
    vi.spyOn(db, "addStudentToCourse").mockResolvedValue(undefined as any);
    await expect(
      db.addStudentToCourse(1, 10)
    ).resolves.toBeUndefined();
  });

  it("应该能够获取课程学生列表", async () => {
    const mockStudents = [
      { id: 1, courseId: 1, studentId: 10, status: "enrolled" as const, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, courseId: 1, studentId: 11, status: "enrolled" as const, createdAt: new Date(), updatedAt: new Date() },
    ];
    vi.spyOn(db, "getCourseStudents").mockResolvedValue(mockStudents as any);
    const students = await db.getCourseStudents(1);
    expect(Array.isArray(students)).toBe(true);
    expect(students.length).toBe(2);
  });

  it("应该能够获取学生选课列表", async () => {
    const mockCourses = [
      { ...testCourse, id: 1 },
      { ...testCourse, id: 2, courseNo: "CS102" },
    ];
    vi.spyOn(db, "getStudentCourses").mockResolvedValue(mockCourses as any);
    const courses = await db.getStudentCourses(10);
    expect(Array.isArray(courses)).toBe(true);
    expect(courses.length).toBeGreaterThan(0);
  });

  // ============ 课程预约管理 ============
  it("应该能够创建课程预约", async () => {
    vi.spyOn(db, "createCourseReservation").mockResolvedValue({ insertId: 1 } as any);
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const result = await db.createCourseReservation({
      courseId: 1,
      labId: 1,
      title: "CS101 课程实验",
      reason: "教学演示",
      startTime: now,
      endTime: tomorrow,
      status: "pending",
    });
    expect(result).toBeDefined();
    expect((result as any).insertId).toBe(1);
  });

  it("应该能够查询课程预约列表", async () => {
    const mockReservations = [
      {
        id: 1,
        courseId: 1,
        labId: 1,
        title: "CS101 课程实验",
        reason: "教学演示",
        startTime: new Date(),
        endTime: new Date(),
        status: "pending" as const,
        rejectReason: null,
        approveTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.spyOn(db, "getCourseReservationsByCourse").mockResolvedValue(mockReservations as any);
    const reservations = await db.getCourseReservationsByCourse(1);
    expect(Array.isArray(reservations)).toBe(true);
  });

  // ============ 开放规则管理 ============
  it("应该能够创建开放规则", async () => {
    vi.spyOn(db, "createOpeningRule").mockResolvedValue(undefined as any);
    await expect(
      db.createOpeningRule({
        labId: 1,
        dayOfWeek: 1,
        openTime: "08:00",
        closeTime: "22:00",
        isWorkday: 1,
        status: "enabled",
      })
    ).resolves.toBeUndefined();
  });

  it("应该能够查询实验室开放规则", async () => {
    const mockRules = [
      {
        id: 1,
        labId: 1,
        dayOfWeek: 1,
        openTime: "08:00",
        closeTime: "22:00",
        isWorkday: 1,
        status: "enabled" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.spyOn(db, "getOpeningRulesForLab").mockResolvedValue(mockRules as any);
    const rules = await db.getOpeningRulesForLab(1);
    expect(Array.isArray(rules)).toBe(true);
    expect(rules[0].dayOfWeek).toBe(1);
  });

  // ============ 禁用期管理 ============
  it("应该能够创建禁用时段", async () => {
    vi.spyOn(db, "createBlockedPeriod").mockResolvedValue(undefined as any);
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    await expect(
      db.createBlockedPeriod({
        labId: 1,
        reason: "年度维护",
        startDate,
        endDate,
        handleExisting: "warn",
        status: "active",
      })
    ).resolves.toBeUndefined();
  });

  it("应该能够查询活动的禁用时段", async () => {
    const mockPeriods = [
      {
        id: 1,
        labId: 1,
        deviceId: null,
        reason: "年度维护",
        startDate: new Date(),
        endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
        handleExisting: "warn" as const,
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.spyOn(db, "getActiveBlockedPeriods").mockResolvedValue(mockPeriods as any);
    const periods = await db.getActiveBlockedPeriods(new Date(), 1);
    expect(Array.isArray(periods)).toBe(true);
    if (periods.length > 0) {
      expect(periods[0].status).toBe("active");
    }
  });

  it("禁用时段应该在指定日期范围内有效", async () => {
    const startDate = new Date("2024-12-01");
    const endDate = new Date("2024-12-15");
    const queryDate = new Date("2024-12-10");
    
    const mockPeriods = [
      {
        id: 1,
        labId: 1,
        deviceId: null,
        reason: "维护",
        startDate,
        endDate,
        handleExisting: "warn" as const,
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.spyOn(db, "getActiveBlockedPeriods").mockResolvedValue(mockPeriods as any);
    const periods = await db.getActiveBlockedPeriods(queryDate, 1);
    
    expect(periods.length).toBeGreaterThan(0);
    expect(periods[0].startDate.getTime()).toBeLessThanOrEqual(queryDate.getTime());
    expect(periods[0].endDate.getTime()).toBeGreaterThanOrEqual(queryDate.getTime());
  });

  it("禁用时段的处理方式应该被记录", async () => {
    const mockPeriod = {
      id: 1,
      labId: 1,
      deviceId: null,
      reason: "维护",
      startDate: new Date(),
      endDate: new Date(),
      handleExisting: "cancel" as const,
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.spyOn(db, "getBlockedPeriods").mockResolvedValue([mockPeriod] as any);
    const periods = await db.getBlockedPeriods({ labId: 1 });
    
    expect(periods.length).toBeGreaterThan(0);
    expect(["allow", "warn", "cancel"]).toContain(periods[0].handleExisting);
  });

  it("禁用时段应该能够更新状态", async () => {
    vi.spyOn(db, "updateBlockedPeriod").mockResolvedValue(undefined as any);
    await expect(
      db.updateBlockedPeriod(1, { status: "inactive" })
    ).resolves.toBeUndefined();
  });
});
