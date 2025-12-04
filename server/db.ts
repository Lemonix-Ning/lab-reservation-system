import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertLabReservation, InsertLabRoom, InsertLabReserveRule, InsertUser, InsertLabDevice, InsertNotification, labReservations, labRooms, labReserveRules, users, labDevices, notifications, approvalConfigs, approvalHistories, violationRecords, blacklist, auditLogs, InsertApprovalConfig, InsertApprovalHistory, InsertViolationRecord, InsertBlacklist, InsertAuditLog } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ 实验室管理 ============

export async function getAllLabRooms() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(labRooms).orderBy(labRooms.createdAt);
}

export async function getLabRoomById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(labRooms).where(eq(labRooms.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLabRoom(room: InsertLabRoom) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(labRooms).values(room);
  return result;
}

export async function updateLabRoom(id: number, room: Partial<InsertLabRoom>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(labRooms).set(room).where(eq(labRooms.id, id));
}

export async function deleteLabRoom(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(labRooms).where(eq(labRooms.id, id));
}

// ============ 预约管理 ============

export async function createReservation(reservation: InsertLabReservation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(labReservations).values(reservation);
  return result;
}

export async function getReservationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(labReservations).where(eq(labReservations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserReservations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(labReservations).where(eq(labReservations.userId, userId)).orderBy(desc(labReservations.createdAt));
}

export async function getAllReservations() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(labReservations).orderBy(desc(labReservations.createdAt));
}

export async function updateReservation(id: number, data: Partial<InsertLabReservation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(labReservations).set(data).where(eq(labReservations.id, id));
}

/**
 * 检查时间段冲突
 * 查询指定实验室在指定时间段内是否存在已通过或待审核的预约
 */
export async function checkTimeConflict(labId: number, startTime: Date, endTime: Date, excludeId?: number) {
  const db = await getDb();
  if (!db) return false;
  
  const conditions = [
    eq(labReservations.labId, labId),
    or(
      eq(labReservations.status, "pending"),
      eq(labReservations.status, "approved")
    ),
    // 时间重叠检测: NOT (end_new <= start_exist OR start_new >= end_exist)
    sql`NOT (${labReservations.endTime} <= ${startTime} OR ${labReservations.startTime} >= ${endTime})`
  ];
  
  if (excludeId) {
    conditions.push(sql`${labReservations.id} != ${excludeId}`);
  }
  
  const conflicts = await db.select().from(labReservations).where(and(...conditions)).limit(1);
  return conflicts.length > 0;
}

/**
 * 统计用户在指定日期的预约次数
 */
export async function countUserReservationsOnDate(userId: number, date: Date) {
  const db = await getDb();
  if (!db) return 0;
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(labReservations)
    .where(
      and(
        eq(labReservations.userId, userId),
        gte(labReservations.startTime, startOfDay),
        lte(labReservations.startTime, endOfDay),
        or(
          eq(labReservations.status, "pending"),
          eq(labReservations.status, "approved")
        )
      )
    );
  
  return result[0]?.count || 0;
}

// ============ 预约规则管理 ============

export async function getAllRules() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(labReserveRules).orderBy(labReserveRules.createdAt);
}

export async function getRuleByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(labReserveRules).where(eq(labReserveRules.ruleCode, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createRule(rule: InsertLabReserveRule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(labReserveRules).values(rule);
  return result;
}

export async function updateRule(id: number, rule: Partial<InsertLabReserveRule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(labReserveRules).set(rule).where(eq(labReserveRules.id, id));
}

/**
 * 完整的预约规则检查
 * 返回检查结果及具体的拒绝原因
 */
export async function checkReservationRules(
  userId: number,
  labId: number,
  startTime: Date,
  endTime: Date
): Promise<{ valid: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot check rules: database not available");
    return { valid: false, reason: "系统错误：数据库不可用" };
  }

  try {
    // ========== 1. 检查 MAX_PER_DAY（每日最大预约次数）==========
    const maxPerDayRule = await getRuleByCode("MAX_PER_DAY");
    if (maxPerDayRule && maxPerDayRule.status === "enabled") {
      const maxPerDay = parseInt(maxPerDayRule.ruleValue, 10);
      if (isNaN(maxPerDay) || maxPerDay <= 0) {
        console.warn(`[Rules] Invalid MAX_PER_DAY value: ${maxPerDayRule.ruleValue}`);
        return { valid: false, reason: "规则配置错误" };
      }

      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(labReservations)
        .where(
          and(
            eq(labReservations.userId, userId),
            gte(labReservations.startTime, new Date(startTime.toDateString())),
            lte(labReservations.startTime, new Date(new Date(startTime.toDateString()).getTime() + 86399999)),
            or(
              eq(labReservations.status, "pending"),
              eq(labReservations.status, "approved")
            )
          )
        );

      const currentCount = countResult[0]?.count || 0;
      if (currentCount >= maxPerDay) {
        return {
          valid: false,
          reason: `每日最多预约 ${maxPerDay} 次，您今日已达上限（已预约 ${currentCount} 次）`
        };
      }
    }

    // ========== 2. 检查 MAX_DURATION（单次预约最长时长）==========
    const maxDurationRule = await getRuleByCode("MAX_DURATION");
    if (maxDurationRule && maxDurationRule.status === "enabled") {
      const maxHours = parseInt(maxDurationRule.ruleValue, 10);
      if (isNaN(maxHours) || maxHours <= 0) {
        console.warn(`[Rules] Invalid MAX_DURATION value: ${maxDurationRule.ruleValue}`);
        return { valid: false, reason: "规则配置错误" };
      }

      const durationMs = endTime.getTime() - startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      if (durationHours > maxHours) {
        return {
          valid: false,
          reason: `单次预约最长 ${maxHours} 小时，您的预约时长为 ${durationHours.toFixed(1)} 小时`
        };
      }
    }

    // ========== 3. 检查 ADVANCE_DAYS（提前预约天数）==========
    const advanceDaysRule = await getRuleByCode("ADVANCE_DAYS");
    if (advanceDaysRule && advanceDaysRule.status === "enabled") {
      const advanceDays = parseInt(advanceDaysRule.ruleValue, 10);
      if (isNaN(advanceDays) || advanceDays < 0) {
        console.warn(`[Rules] Invalid ADVANCE_DAYS value: ${advanceDaysRule.ruleValue}`);
        return { valid: false, reason: "规则配置错误" };
      }

      const now = new Date();
      const earliestStart = new Date(now.getTime() + advanceDays * 24 * 60 * 60 * 1000);

      if (startTime < earliestStart) {
        const daysUntilEarliest = Math.ceil((earliestStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return {
          valid: false,
          reason: `必须至少提前 ${advanceDays} 天预约，最早可预约日期为 ${earliestStart.toLocaleDateString()}`
        };
      }
    }

    // ========== 规则检查通过 ==========
    return { valid: true };
  } catch (error) {
    console.error("[Rules] Error checking reservation rules:", error);
    return { valid: false, reason: "规则检查失败，请稍后重试" };
  }
}

/**
 * 获取所有启用的规则（用于前端显示）
 */
export async function getEnabledRules() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(labReserveRules).where(eq(labReserveRules.status, "enabled"));
}

// ============ 设备管理 ============

export async function getAllDevices() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(labDevices).orderBy(labDevices.createdAt);
}

export async function getDeviceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(labDevices).where(eq(labDevices.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDevicesByLabId(labId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(labDevices).where(eq(labDevices.labId, labId)).orderBy(labDevices.createdAt);
}

export async function createDevice(device: InsertLabDevice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 清理不必要的字段
  const cleanData: any = {
    labId: device.labId,
    deviceNo: device.deviceNo,
    name: device.name,
    status: device.status || "available",
  };
  
  // 只在有值时添加可选字段
  if (device.type) cleanData.type = device.type;
  if (device.purchaseDate) cleanData.purchaseDate = device.purchaseDate;
  if (device.description) cleanData.description = device.description;
  
  const result = await db.insert(labDevices).values(cleanData);
  return result;
}

export async function updateDevice(id: number, device: Partial<InsertLabDevice>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(labDevices).set(device).where(eq(labDevices.id, id));
}

export async function deleteDevice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(labDevices).where(eq(labDevices.id, id));
}

// ============ 统计分析 ============

/**
 * 获取实验室使用率统计
 * @param startDate 开始日期
 * @param endDate 结束日期
 */
export async function getLabUsageStatistics(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const reservations = await db
    .select({
      labId: labReservations.labId,
      labName: labRooms.name,
      totalReservations: sql<number>`COUNT(DISTINCT ${labReservations.id})`.as('totalReservations'),
      approvedReservations: sql<number>`SUM(CASE WHEN ${labReservations.status} = 'approved' THEN 1 ELSE 0 END)`.as('approvedReservations'),
      totalHours: sql<number>`SUM(TIMESTAMPDIFF(HOUR, ${labReservations.startTime}, ${labReservations.endTime}))`.as('totalHours'),
    })
    .from(labReservations)
    .innerJoin(labRooms, eq(labReservations.labId, labRooms.id))
    .where(
      and(
        gte(labReservations.startTime, startDate),
        lte(labReservations.endTime, endDate)
      )
    )
    .groupBy(labReservations.labId, labRooms.name);
  
  return reservations;
}

/**
 * 获取用户预约活跃度排行
 * @param limit 返回数量
 * @param startDate 开始日期
 * @param endDate 结束日期
 */
export async function getUserActivityRanking(limit: number = 10, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const users = await db
    .select({
      userId: labReservations.userId,
      userName: sql<string>`'User ' || ${labReservations.userId}`.as('userName'),
      totalReservations: sql<number>`COUNT(*)`.as('totalReservations'),
      approvedCount: sql<number>`SUM(CASE WHEN ${labReservations.status} = 'approved' THEN 1 ELSE 0 END)`.as('approvedCount'),
      totalHours: sql<number>`SUM(TIMESTAMPDIFF(HOUR, ${labReservations.startTime}, ${labReservations.endTime}))`.as('totalHours'),
    })
    .from(labReservations)
    .where(
      and(
        gte(labReservations.startTime, startDate),
        lte(labReservations.endTime, endDate)
      )
    )
    .groupBy(labReservations.userId)
    .orderBy(desc(sql<number>`COUNT(*)`))
    .limit(limit);
  
  return users;
}

/**
 * 获取时间段预约分布
 * @param startDate 开始日期
 * @param endDate 结束日期
 */
export async function getReservationTimeDistribution(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const distribution = await db
    .select({
      date: sql<string>`DATE(${labReservations.startTime})`.as('date'),
      count: sql<number>`COUNT(*)`.as('count'),
      approvedCount: sql<number>`SUM(CASE WHEN ${labReservations.status} = 'approved' THEN 1 ELSE 0 END)`.as('approvedCount'),
      pendingCount: sql<number>`SUM(CASE WHEN ${labReservations.status} = 'pending' THEN 1 ELSE 0 END)`.as('pendingCount'),
    })
    .from(labReservations)
    .where(
      and(
        gte(labReservations.startTime, startDate),
        lte(labReservations.endTime, endDate)
      )
    )
    .groupBy(sql`DATE(${labReservations.startTime})`)
    .orderBy(sql`DATE(${labReservations.startTime})`);
  
  return distribution;
}

/**
 * 获取预约状态统计
 * @param startDate 开始日期
 * @param endDate 结束日期
 */
export async function getReservationStatusStatistics(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const statistics = await db
    .select({
      status: labReservations.status,
      count: sql<number>`COUNT(*)`.as('count'),
      totalHours: sql<number>`SUM(TIMESTAMPDIFF(HOUR, ${labReservations.startTime}, ${labReservations.endTime}))`.as('totalHours'),
    })
    .from(labReservations)
    .where(
      and(
        gte(labReservations.startTime, startDate),
        lte(labReservations.endTime, endDate)
      )
    )
    .groupBy(labReservations.status);
  
  return statistics;
}

/**
 * 获取总体统计摘要
 * @param startDate 开始日期
 * @param endDate 结束日期
 */
export async function getStatisticsSummary(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;
  
  const summary = await db
    .select({
      totalReservations: sql<number>`COUNT(*)`.as('totalReservations'),
      approvedReservations: sql<number>`SUM(CASE WHEN ${labReservations.status} = 'approved' THEN 1 ELSE 0 END)`.as('approvedReservations'),
      pendingReservations: sql<number>`SUM(CASE WHEN ${labReservations.status} = 'pending' THEN 1 ELSE 0 END)`.as('pendingReservations'),
      rejectedReservations: sql<number>`SUM(CASE WHEN ${labReservations.status} = 'rejected' THEN 1 ELSE 0 END)`.as('rejectedReservations'),
      totalUsers: sql<number>`COUNT(DISTINCT ${labReservations.userId})`.as('totalUsers'),
      totalLabs: sql<number>`COUNT(DISTINCT ${labReservations.labId})`.as('totalLabs'),
      totalHours: sql<number>`SUM(TIMESTAMPDIFF(HOUR, ${labReservations.startTime}, ${labReservations.endTime}))`.as('totalHours'),
    })
    .from(labReservations)
    .where(
      and(
        gte(labReservations.startTime, startDate),
        lte(labReservations.endTime, endDate)
      )
    );
  
  return summary.length > 0 ? summary[0] : null;
}

// ============ 通知管理 ============

/**
 * 创建通知
 */
export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(notifications).values(notification);
}

/**
 * 获取用户的通知列表
 * @param userId 用户ID
 * @param limit 返回数量限制，默认50
 */
export async function getUserNotifications(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/**
 * 获取用户未读通知数量
 */
export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, 0)
      )
    );
  
  return result.length > 0 ? result[0].count : 0;
}

/**
 * 标记通知为已读
 */
export async function markNotificationAsRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(notifications)
    .set({ isRead: 1 })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      )
    );
}

/**
 * 标记所有通知为已读
 */
export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(notifications)
    .set({ isRead: 1 })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, 0)
      )
    );
}

/**
 * 删除通知
 */
export async function deleteNotification(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      )
    );
}

// ============ 审批配置管理 ============

export async function getApprovalConfigForLab(labId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  // 优先查询特定实验室配置，否则返回全局配置
  const result = await db
    .select()
    .from(approvalConfigs)
    .where(eq(approvalConfigs.labId, labId))
    .limit(1);
  
  if (result.length > 0) return result[0];
  
  // 如果没有特定实验室配置，查询全局配置（labId 为 0 或空）
  const globalResult = await db
    .select()
    .from(approvalConfigs)
    .where(or(eq(approvalConfigs.labId, 0), eq(approvalConfigs.labId, null as any)))
    .limit(1);
  
  return globalResult.length > 0 ? globalResult[0] : undefined;
}

export async function createApprovalConfig(config: InsertApprovalConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(approvalConfigs).values(config);
}

export async function updateApprovalConfig(id: number, config: Partial<InsertApprovalConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(approvalConfigs).set(config).where(eq(approvalConfigs.id, id));
}

// ============ 审批历史 ============

export async function createApprovalHistory(history: InsertApprovalHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(approvalHistories).values(history);
}

export async function getApprovalHistoriesForReservation(reservationId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(approvalHistories)
    .where(eq(approvalHistories.reservationId, reservationId))
    .orderBy(approvalHistories.approvalStage);
}

// ============ 违约记录 ============

export async function recordViolation(violation: InsertViolationRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(violationRecords).values(violation);
  
  // 同步更新黑名单中的总违约分
  const userViolations = await db
    .select({ total: sql<number>`SUM(points)` })
    .from(violationRecords)
    .where(eq(violationRecords.userId, violation.userId));
  
  const totalPoints = userViolations[0]?.total || 0;
  
  // 如果违约分超过阈值（假设阈值为10分），加入黑名单
  const threshold = 10;
  if (totalPoints >= threshold) {
    const existingBlacklist = await db
      .select()
      .from(blacklist)
      .where(eq(blacklist.userId, violation.userId))
      .limit(1);
    
    if (existingBlacklist.length === 0) {
      // 新增黑名单，限制7天
      const restrictedUntil = new Date();
      restrictedUntil.setDate(restrictedUntil.getDate() + 7);
      
      await db.insert(blacklist).values({
        userId: violation.userId,
        totalViolationPoints: totalPoints,
        violationThreshold: threshold,
        restrictionType: 'time_limit',
        restrictedUntil,
        reason: '违约分超过阈值，自动加入黑名单',
      });
    } else {
      // 更新已有黑名单记录
      await db
        .update(blacklist)
        .set({ totalViolationPoints: totalPoints })
        .where(eq(blacklist.userId, violation.userId));
    }
  }
  
  return result;
}

export async function getUserViolations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(violationRecords)
    .where(eq(violationRecords.userId, userId))
    .orderBy(desc(violationRecords.recordedAt));
}

export async function getAllViolations() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      id: violationRecords.id,
      userId: violationRecords.userId,
      userName: users.name,
      reservationId: violationRecords.reservationId,
      violationType: violationRecords.violationType,
      points: violationRecords.points,
      description: violationRecords.description,
      recordedAt: violationRecords.recordedAt,
      createdAt: violationRecords.createdAt,
    })
    .from(violationRecords)
    .leftJoin(users, eq(violationRecords.userId, users.id))
    .orderBy(desc(violationRecords.recordedAt));
}

export async function getUserTotalViolationPoints(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(points), 0)` })
    .from(violationRecords)
    .where(eq(violationRecords.userId, userId));
  
  return result[0]?.total || 0;
}

// ============ 黑名单管理 ============

export async function getUserBlacklist(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(blacklist)
    .where(eq(blacklist.userId, userId))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function isUserBlacklisted(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const record = await db
    .select()
    .from(blacklist)
    .where(
      and(
        eq(blacklist.userId, userId),
        or(
          eq(blacklist.restrictionType, 'time_limit'),
          eq(blacklist.restrictionType, 'resource_limit')
        )
      )
    )
    .limit(1);
  
  if (record.length === 0) return false;
  
  const bl = record[0];
  if (bl.restrictionType === 'time_limit' && bl.restrictedUntil) {
    return new Date() < bl.restrictedUntil;
  }
  
  return true;
}

export async function removeFromBlacklist(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(blacklist).where(eq(blacklist.userId, userId));
}

// ============ 审计日志 ============

export async function createAuditLog(log: InsertAuditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(auditLogs).values(log);
}

export async function getAuditLogs(filters: {
  operatorUserId?: number;
  operationType?: string;
  targetType?: string;
  targetId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters.operatorUserId) conditions.push(eq(auditLogs.operatorUserId, filters.operatorUserId));
  if (filters.operationType) conditions.push(eq(auditLogs.operationType, filters.operationType));
  if (filters.targetType) conditions.push(eq(auditLogs.targetType, filters.targetType));
  if (filters.targetId) conditions.push(eq(auditLogs.targetId, filters.targetId));
  if (filters.startDate) conditions.push(gte(auditLogs.operatedAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(auditLogs.operatedAt, filters.endDate));
  
  let baseQuery = db
    .select({
      id: auditLogs.id,
      operatorUserId: auditLogs.operatorUserId,
      operatorName: users.name,
      operationType: auditLogs.operationType,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      details: auditLogs.details,
      reason: auditLogs.reason,
      result: auditLogs.result,
      ipAddress: auditLogs.ipAddress,
      operatedAt: auditLogs.operatedAt,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.operatorUserId, users.id))
    .orderBy(desc(auditLogs.operatedAt)) as any;
  
  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions));
  }
  
  if (filters.limit) baseQuery = baseQuery.limit(filters.limit);
  if (filters.offset) baseQuery = baseQuery.offset(filters.offset);
  
  return await baseQuery;
}

export async function getAuditLogsByReservation(reservationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.targetType, 'reservation'),
        eq(auditLogs.targetId, reservationId)
      )
    )
    .orderBy(desc(auditLogs.operatedAt));
}
