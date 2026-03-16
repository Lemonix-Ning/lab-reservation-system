/**
 * 3L 智能推荐算法 (Lab-Load-Like)
 * 
 * 暂未启用 —— 需要时在 routers.ts 中 import 并注册路由即可
 * 
 * 三维度评分：
 * - Lab（适配度 40%）：容量匹配 + 课程关联
 * - Load（负载 35%）：近期预约密度，越低越好
 * - Like（偏好 25%）：用户历史使用频率
 */

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { labRooms, labReservations, courseStudents, courseSchedules } from "../drizzle/schema";

export interface LabRecommendation {
  labId: number;
  labName: string;
  roomNo: string;
  building: string | null;
  capacity: number;
  type: string | null;
  /** 综合评分 0-100 */
  totalScore: number;
  /** Lab 适配度评分 0-100 */
  labScore: number;
  /** Load 负载评分 0-100 (越空闲越高) */
  loadScore: number;
  /** Like 偏好评分 0-100 */
  likeScore: number;
  /** 推荐理由标签 */
  tags: string[];
  /** 近7天已有预约数 */
  upcomingReservations: number;
  /** 用户历史使用次数 */
  userHistoryCount: number;
}

export async function getLabRecommendations(
  userId: number,
  peopleCount?: number,
): Promise<LabRecommendation[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // 1) 获取所有启用的实验室
    const allLabs = await db
      .select()
      .from(labRooms)
      .where(eq(labRooms.status, "enabled"));

    if (allLabs.length === 0) return [];

    // 2) 获取用户选课 → 关联的实验室（通过 courseSchedules）
    const userCourseRows = await db
      .select({ courseId: courseStudents.courseId })
      .from(courseStudents)
      .where(
        and(
          eq(courseStudents.studentId, userId),
          eq(courseStudents.status, "enrolled"),
        ),
      );
    const userCourseIds = userCourseRows.map((r) => r.courseId);

    // 获取这些课程排课关联的实验室 ID
    const courseLabIds: Set<number> = new Set();
    const courseLabTypes: Set<string> = new Set();
    if (userCourseIds.length > 0) {
      const scheduleRows = await db
        .select({
          labId: courseSchedules.labId,
        })
        .from(courseSchedules)
        .where(
          and(
            sql`${courseSchedules.courseId} IN (${sql.join(
              userCourseIds.map((id) => sql`${id}`),
              sql`,`,
            )})`,
            eq(courseSchedules.status, "approved"),
          ),
        );
      for (const row of scheduleRows) {
        courseLabIds.add(row.labId);
      }
      for (const lab of allLabs) {
        if (courseLabIds.has(lab.id) && lab.type) {
          courseLabTypes.add(lab.type);
        }
      }
    }

    // 3) 近 7 天各实验室的预约数
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingRows = await db
      .select({
        labId: labReservations.labId,
        cnt: sql<number>`COUNT(*)`.as("cnt"),
      })
      .from(labReservations)
      .where(
        and(
          gte(labReservations.startTime, now),
          lte(labReservations.startTime, weekLater),
          sql`${labReservations.status} IN ('pending', 'approved')`,
        ),
      )
      .groupBy(labReservations.labId);

    const loadMap = new Map<number, number>();
    let maxLoad = 1;
    for (const row of upcomingRows) {
      const cnt = Number(row.cnt);
      loadMap.set(row.labId, cnt);
      if (cnt > maxLoad) maxLoad = cnt;
    }

    // 4) 用户历史：每个实验室的使用次数（approved/completed）
    const historyRows = await db
      .select({
        labId: labReservations.labId,
        cnt: sql<number>`COUNT(*)`.as("cnt"),
      })
      .from(labReservations)
      .where(
        and(
          eq(labReservations.userId, userId),
          sql`${labReservations.status} IN ('approved', 'completed')`,
        ),
      )
      .groupBy(labReservations.labId);

    const historyMap = new Map<number, number>();
    let maxHistory = 1;
    for (const row of historyRows) {
      const cnt = Number(row.cnt);
      historyMap.set(row.labId, cnt);
      if (cnt > maxHistory) maxHistory = cnt;
    }

    // 5) 计算每个实验室的 3L 得分
    const requestPeople = peopleCount || 10;

    const results: LabRecommendation[] = allLabs.map((lab) => {
      const tags: string[] = [];
      const cap = lab.capacity || 1;

      // ── Lab Score (适配度) ──
      let labScore = 0;

      // 容量匹配 (60% of Lab dimension)
      if (requestPeople > cap) {
        labScore += 5;
        tags.push("容量不足");
      } else {
        const utilization = requestPeople / cap;
        const capScore = utilization >= 0.5 ? 100 * (1 - Math.abs(utilization - 0.7) / 0.5) : utilization * 120;
        labScore += Math.max(0, Math.min(100, capScore)) * 0.6;
        if (utilization >= 0.5 && utilization <= 0.9) tags.push("容量匹配");
      }

      // 课程关联 (40% of Lab dimension)
      if (courseLabIds.has(lab.id)) {
        labScore += 100 * 0.4;
        tags.push("课程关联");
      } else if (lab.type && courseLabTypes.has(lab.type)) {
        labScore += 60 * 0.4;
        tags.push("类型匹配");
      } else {
        labScore += 10 * 0.4;
      }

      // ── Load Score (负载) ──
      const labLoad = loadMap.get(lab.id) || 0;
      const loadScore = Math.round((1 - labLoad / maxLoad) * 100);
      if (labLoad === 0) tags.push("本周空闲");
      else if (labLoad <= maxLoad * 0.3) tags.push("负载较低");

      // ── Like Score (偏好) ──
      const userCount = historyMap.get(lab.id) || 0;
      const likeScore = Math.round((userCount / maxHistory) * 100);
      if (userCount >= 3) tags.push("常用实验室");
      else if (userCount >= 1) tags.push("曾使用");

      // ── 综合得分 ──
      const totalScore = Math.round(
        labScore * 0.4 + loadScore * 0.35 + likeScore * 0.25,
      );

      return {
        labId: lab.id,
        labName: lab.name,
        roomNo: lab.roomNo,
        building: lab.building,
        capacity: cap,
        type: lab.type,
        totalScore,
        labScore: Math.round(labScore),
        loadScore,
        likeScore,
        tags,
        upcomingReservations: labLoad,
        userHistoryCount: userCount,
      };
    });

    results.sort((a, b) => b.totalScore - a.totalScore);
    return results;
  } catch (error) {
    console.error("Error in getLabRecommendations:", error);
    return [];
  }
}
