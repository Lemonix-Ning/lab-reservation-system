import { and, desc, eq, gte, lte, or, sql, lt, gt, ne, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertLabReservation, InsertLabRoom, InsertLabReserveRule, InsertUser, InsertLabDevice, InsertNotification, labReservations, labRooms, labReserveRules, users, labDevices, notifications, approvalConfigs, approvalHistories, violationRecords, blacklist, auditLogs, InsertApprovalConfig, InsertApprovalHistory, InsertViolationRecord, InsertBlacklist, InsertAuditLog, courses, courseReservations, courseStudents, openingRules, blockedPeriods, InsertCourse, InsertCourseReservation, InsertCourseStudent, InsertOpeningRule, InsertBlockedPeriod, classes, classStudents, InsertClass, InsertClassStudent } from "../drizzle/schema";
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
      values.role = 'sysAdmin';
      updateSet.role = 'sysAdmin';
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

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
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
  return await db.select().from(labReservations).where(eq(labReservations.userId, userId)).orderBy(desc(labReservations.updatedAt), desc(labReservations.createdAt));
}

export async function getAllReservations() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(labReservations).orderBy(desc(labReservations.updatedAt), desc(labReservations.createdAt));
}

export type ReservationPageResult = {
  items: any[];
  total: number;
};

export async function getReservationsPaged(opts: { page?: number; pageSize?: number; q?: string; status?: string; labId?: number; }) : Promise<ReservationPageResult> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const page = opts.page && opts.page > 0 ? opts.page : 1;
  const pageSize = opts.pageSize && opts.pageSize > 0 ? opts.pageSize : 10;
  const offset = (page - 1) * pageSize;

  const whereClauses: any[] = [];
  if (opts.status) {
    // status is a string union; use SQL expression to avoid strict enum typing issues
    whereClauses.push(sql`${labReservations.status} = ${opts.status}`);
  }
  if (opts.labId) {
    whereClauses.push(eq(labReservations.labId, opts.labId));
  }
  if (opts.q && opts.q.trim()) {
    const q = `%${opts.q.trim()}%`;
    whereClauses.push(sql`(${labReservations.title} LIKE ${q} OR ${labReservations.reason} LIKE ${q})`);
  }

  const totalRes = await db.select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(labReservations)
    .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);

  const total = totalRes && totalRes.length > 0 ? Number(totalRes[0].count) : 0;

  const items = await db.select().from(labReservations)
    .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
    // 按更新时间倒序排列，确保最新操作（新增、修改、审核等）始终排在最前
    .orderBy(
      desc(labReservations.updatedAt),
      desc(labReservations.createdAt)
    )
    .limit(pageSize)
    .offset(offset);

  return { items, total };
}

export async function updateReservation(id: number, data: Partial<InsertLabReservation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 不手动设置 updatedAt，让数据库的 ON UPDATE CURRENT_TIMESTAMP 自动更新
  // 这样可以确保时区一致，并且时间戳准确，排序正确
  const updateData = { ...data };
  
  await db.update(labReservations).set(updateData).where(eq(labReservations.id, id));
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
 * 获取与指定时间段冲突的所有预约详情
 * 用于显示具体冲突信息
 */
export async function getConflictingReservations(labId: number, startTime: Date, endTime: Date, excludeId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(labReservations.labId, labId),
    or(
      eq(labReservations.status, "pending"),
      eq(labReservations.status, "approved")
    ),
    // 时间重叠检测: NOT (end_new <= start_exist OR start_new >= end_exist)
    // 转换为: (end_new > start_exist AND start_new < end_exist)
    gt(labReservations.endTime, startTime),
    lt(labReservations.startTime, endTime)
  ];
  
  if (excludeId) {
    conditions.push(ne(labReservations.id, excludeId));
  }
  
  const conflicts = await db.select().from(labReservations).where(and(...conditions));
  
  return conflicts;
}

/**
 * 获取所有有时间冲突的预约
 * 用于管理员筛选和处理冲突
 */
export async function getAllConflictingReservations(filters?: {
  startDate?: string;
  endDate?: string;
  labId?: number;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  try {
    console.log('[Conflicts] Searching with filters:', filters);
    
    // 构建基础查询条件
    const conditions = [];
    
    // 状态过滤：如果指定了 status，只查该状态；否则查 pending + approved
    if (filters?.status) {
      conditions.push(eq(labReservations.status, filters.status as any));
    } else {
      conditions.push(
        or(
          eq(labReservations.status, "pending"),
          eq(labReservations.status, "approved")
        )
      );
    }

    // 时间范围过滤
    if (filters?.startDate) {
      conditions.push(gte(labReservations.startTime, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      conditions.push(lte(labReservations.startTime, new Date(filters.endDate)));
    }
    
    // 实验室过滤
    if (filters?.labId) {
      conditions.push(eq(labReservations.labId, filters.labId));
    }

    // 查询所有符合条件的预约
    const allReservations = await db
      .select()
      .from(labReservations)
      .where(and(...conditions))
      .orderBy(labReservations.startTime);

    // 检测每个预约是否有冲突
    const conflictingReservations = [];
    
    for (const reservation of allReservations) {
      const conflicts = await getConflictingReservations(
        reservation.labId,
        reservation.startTime,
        reservation.endTime,
        reservation.id
      );

      if (conflicts.length > 0) {
        conflictingReservations.push({
          ...reservation,
          conflictCount: conflicts.length,
          conflictIds: conflicts.map(c => c.id),
        });
      }
    }

    return conflictingReservations;
  } catch (error) {
    console.error("[Database] Error in getAllConflictingReservations:", error);
    return [];
  }
}

/**
 * 获取时间段内的冲突预约详情（含用户信息）
 * 用于前端在预约表单中显示冲突提示
 */
export async function getConflictingReservationDetails(labId: number, startTime: Date, endTime: Date) {
  const db = await getDb();
  if (!db) return [];

  const conflicts = await getConflictingReservations(labId, startTime, endTime);
  
  // 丰富冲突预约的信息（添加用户名）
  const enrichedConflicts = await Promise.all(
    conflicts.map(async (conflict) => {
      const user = await getUserById(conflict.userId);
      return {
        id: conflict.id,
        title: conflict.title,
        startTime: conflict.startTime,
        endTime: conflict.endTime,
        status: conflict.status,
        userName: user?.name || '未知用户',
        userEmail: user?.email || '',
        peopleCount: conflict.peopleCount,
        reason: conflict.reason,
      };
    })
  );

  return enrichedConflicts;
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
    // ========== 0. 检查时间冲突（优先级最高）==========
    const conflicts = await getConflictingReservations(labId, startTime, endTime);
    if (conflicts.length > 0) {
      return {
        valid: false,
        reason: `选定时间段内存在 ${conflicts.length} 个冲突预约，请调整时间或查看替代方案`
      };
    }

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

      // 标准化时间到天的开始（00:00:00）
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const earliestStart = new Date(todayStart.getTime() + advanceDays * 24 * 60 * 60 * 1000);
      const reservationDayStart = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate(), 0, 0, 0, 0);

      if (reservationDayStart < earliestStart) {
        const daysUntilEarliest = Math.ceil((earliestStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
        return {
          valid: false,
          reason: `必须至少提前 ${advanceDays} 天预约，最早可预约日期为 ${earliestStart.toLocaleDateString()}`
        };
      }
    }

    // ========== 4. 检查禁用时段（优先级最高）==========
    const blockedPeriodsList = await getOverlappingBlockedPeriods(startTime, endTime, labId);
    if (blockedPeriodsList.length > 0) {
      const blocked = blockedPeriodsList[0]; // 取第一个冲突的禁用时段
      const reasonLabel = blocked.reason === 'maintenance' ? '维护' : 
                         blocked.reason === 'vacation' ? '假期' : 
                         blocked.reason === 'inspection' ? '检查' : '其他';
      return {
        valid: false,
        reason: `该时间段处于${reasonLabel}禁用期（${new Date(blocked.startDate).toLocaleDateString()} - ${new Date(blocked.endDate).toLocaleDateString()}），无法预约`
      };
    }

    // ========== 5. 检查开放规则 ==========
    const openingRulesList = await getOpeningRulesForLab(labId);
    if (openingRulesList && openingRulesList.length > 0) {
      // 检查预约的每一天是否都在开放时间内
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);

      // 仅按“日期”维度遍历，不比较具体时间戳
      const checkDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

      while (checkDate <= endDateOnly) {
        const dayOfWeek = checkDate.getDay(); // 0=周日, 1=周一, ..., 6=周六
        const dayRule = openingRulesList.find((r: any) => r.dayOfWeek === dayOfWeek && r.status === 'enabled');

        if (dayRule) {
          // 解析开放时间（HH:mm格式）
          const [openHour, openMin] = dayRule.openTime.split(':').map(Number);
          const [closeHour, closeMin] = dayRule.closeTime.split(':').map(Number);

          const ruleOpenTime = new Date(checkDate);
          ruleOpenTime.setHours(openHour, openMin, 0, 0);
          const ruleCloseTime = new Date(checkDate);
          ruleCloseTime.setHours(closeHour, closeMin, 0, 0);

          // 判断当前检查的日期是否为开始/结束所在日期（按年月日比较）
          const isStartDay =
            checkDate.getFullYear() === startDate.getFullYear() &&
            checkDate.getMonth() === startDate.getMonth() &&
            checkDate.getDate() === startDate.getDate();
          const isEndDay =
            checkDate.getFullYear() === endDate.getFullYear() &&
            checkDate.getMonth() === endDate.getMonth() &&
            checkDate.getDate() === endDate.getDate();

          const reservationStart = isStartDay
            ? startTime
            : new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 0, 0, 0, 0);
          const reservationEnd = isEndDay
            ? endTime
            : new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 23, 59, 59, 999);

          if (reservationStart < ruleOpenTime || reservationEnd > ruleCloseTime) {
            const dayLabel = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek];
            return {
              valid: false,
              reason: `${dayLabel}的开放时间为 ${dayRule.openTime} - ${dayRule.closeTime}，您的预约时间不在开放范围内`
            };
          }
        } else {
          // 如果没有配置该天的规则，默认不允许（安全策略）
          const dayLabel = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek];
          return {
            valid: false,
            reason: `${dayLabel}未配置开放规则，无法预约`
          };
        }

        // 移动到下一天（仅按日期递增）
        checkDate.setDate(checkDate.getDate() + 1);
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
 * 检查预约规则（排除 ADVANCE_DAYS 规则）
 * 用于管理员绕过提前预约天数限制的情况
 */
export async function checkReservationRulesExceptAdvance(
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

    // 注意：跳过 ADVANCE_DAYS 检查

    // ========== 4. 检查禁用时段（优先级最高）==========
    const blockedPeriodsList = await getOverlappingBlockedPeriods(startTime, endTime, labId);
    if (blockedPeriodsList.length > 0) {
      const blocked = blockedPeriodsList[0]; // 取第一个冲突的禁用时段
      const reasonLabel = blocked.reason === 'maintenance' ? '维护' : 
                         blocked.reason === 'vacation' ? '假期' : 
                         blocked.reason === 'inspection' ? '检查' : '其他';
      return {
        valid: false,
        reason: `该时间段处于${reasonLabel}禁用期（${new Date(blocked.startDate).toLocaleDateString()} - ${new Date(blocked.endDate).toLocaleDateString()}），无法预约`
      };
    }

    // ========== 5. 检查开放规则 ==========
    const openingRulesList = await getOpeningRulesForLab(labId);
    if (openingRulesList && openingRulesList.length > 0) {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);

      const checkDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

      while (checkDate <= endDateOnly) {
        const dayOfWeek = checkDate.getDay();
        const dayRule = openingRulesList.find((r: any) => r.dayOfWeek === dayOfWeek && r.status === 'enabled');

        if (dayRule) {
          const [openHour, openMin] = dayRule.openTime.split(':').map(Number);
          const [closeHour, closeMin] = dayRule.closeTime.split(':').map(Number);

          const ruleOpenTime = new Date(checkDate);
          ruleOpenTime.setHours(openHour, openMin, 0, 0);
          const ruleCloseTime = new Date(checkDate);
          ruleCloseTime.setHours(closeHour, closeMin, 0, 0);

          const isStartDay =
            checkDate.getFullYear() === startDate.getFullYear() &&
            checkDate.getMonth() === startDate.getMonth() &&
            checkDate.getDate() === startDate.getDate();
          const isEndDay =
            checkDate.getFullYear() === endDate.getFullYear() &&
            checkDate.getMonth() === endDate.getMonth() &&
            checkDate.getDate() === endDate.getDate();

          const reservationStart = isStartDay
            ? startTime
            : new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 0, 0, 0, 0);
          const reservationEnd = isEndDay
            ? endTime
            : new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 23, 59, 59, 999);

          if (reservationStart < ruleOpenTime || reservationEnd > ruleCloseTime) {
            const dayLabel = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek];
            return {
              valid: false,
              reason: `${dayLabel}的开放时间为 ${dayRule.openTime} - ${dayRule.closeTime}，您的预约时间不在开放范围内`
            };
          }
        } else {
          const dayLabel = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek];
          return {
            valid: false,
            reason: `${dayLabel}未配置开放规则，无法预约`
          };
        }

        checkDate.setDate(checkDate.getDate() + 1);
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
  
  // 使用原生 SQL 避免 Drizzle ORM 的 groupBy 问题
  const [rows] = await db.execute(sql`
    SELECT 
      r.labId,
      lr.name as labName,
      COUNT(DISTINCT r.id) as totalReservations,
      SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) as approvedReservations,
      SUM(TIMESTAMPDIFF(HOUR, r.startTime, r.endTime)) as totalHours
    FROM lab_reservations r
    INNER JOIN lab_rooms lr ON r.labId = lr.id
    WHERE r.startTime < ${endDate}
      AND r.endTime > ${startDate}
    GROUP BY r.labId, lr.name
    ORDER BY r.labId
  `);
  
  return (Array.isArray(rows) ? rows : []) as any[];
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
        lt(labReservations.startTime, endDate),
        gt(labReservations.endTime, startDate)
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
        lt(labReservations.startTime, endDate),
        gt(labReservations.endTime, startDate)
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
        lt(labReservations.startTime, endDate),
        gt(labReservations.endTime, startDate)
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
      approvedReservations: sql<number>`COALESCE(SUM(CASE WHEN ${labReservations.status} = 'approved' THEN 1 ELSE 0 END), 0)`.as('approvedReservations'),
      pendingReservations: sql<number>`COALESCE(SUM(CASE WHEN ${labReservations.status} = 'pending' THEN 1 ELSE 0 END), 0)`.as('pendingReservations'),
      rejectedReservations: sql<number>`COALESCE(SUM(CASE WHEN ${labReservations.status} = 'rejected' THEN 1 ELSE 0 END), 0)`.as('rejectedReservations'),
      totalUsers: sql<number>`COUNT(DISTINCT ${labReservations.userId})`.as('totalUsers'),
      totalLabs: sql<number>`COUNT(DISTINCT ${labReservations.labId})`.as('totalLabs'),
      totalHours: sql<number>`COALESCE(SUM(TIMESTAMPDIFF(HOUR, ${labReservations.startTime}, ${labReservations.endTime})), 0)`.as('totalHours'),
    })
    .from(labReservations)
    .where(
      and(
        lt(labReservations.startTime, endDate),
        gt(labReservations.endTime, startDate)
      )
    );
  
  // 强制转换为数字类型
  const result = summary.length > 0 ? summary[0] : null;
  if (result) {
    return {
      totalReservations: Number(result.totalReservations),
      approvedReservations: Number(result.approvedReservations),
      pendingReservations: Number(result.pendingReservations),
      rejectedReservations: Number(result.rejectedReservations),
      totalUsers: Number(result.totalUsers),
      totalLabs: Number(result.totalLabs),
      totalHours: Number(result.totalHours),
    };
  }
  return null;
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
    .where(or(eq(approvalConfigs.labId, 0), isNull(approvalConfigs.labId)))
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
      classId: classStudents.classId,
      className: classes.name,
      reservationId: violationRecords.reservationId,
      violationType: violationRecords.violationType,
      points: violationRecords.points,
      description: violationRecords.description,
      recordedAt: violationRecords.recordedAt,
      createdAt: violationRecords.createdAt,
    })
    .from(violationRecords)
    .leftJoin(users, eq(violationRecords.userId, users.id))
    .leftJoin(classStudents, eq(classStudents.studentId, violationRecords.userId))
    .leftJoin(classes, eq(classes.id, classStudents.classId))
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

// ============ 审批配置查询 ============

export async function getAllApprovalConfigs() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(approvalConfigs).orderBy(approvalConfigs.createdAt);
}

// ============ 黑名单查询 ============

export async function getAllBlacklistUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      id: blacklist.id,
      userId: blacklist.userId,
      userName: users.name,
      classId: classStudents.classId,
      className: classes.name,
      totalViolationPoints: blacklist.totalViolationPoints,
      violationThreshold: blacklist.violationThreshold,
      restrictionType: blacklist.restrictionType,
      restrictedUntil: blacklist.restrictedUntil,
      restrictedLabIds: blacklist.restrictedLabIds,
      reason: blacklist.reason,
      createdAt: blacklist.createdAt,
    })
    .from(blacklist)
    .leftJoin(users, eq(blacklist.userId, users.id))
    .leftJoin(classStudents, eq(classStudents.studentId, blacklist.userId))
    .leftJoin(classes, eq(classes.id, classStudents.classId))
    .orderBy(desc(blacklist.createdAt));
}

export async function addToBlacklist(userId: number, data: Partial<InsertBlacklist>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserBlacklist(userId);
  if (existing) {
    await db.update(blacklist).set(data).where(eq(blacklist.userId, userId));
  } else {
    await db.insert(blacklist).values({
      userId,
      totalViolationPoints: 0,
      violationThreshold: 10,
      restrictionType: 'time_limit',
      ...data,
    });
  }
}

// ============ 课程管理（Phase 4 P1）============

export async function checkCourseNoExists(courseNo: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.courseNo, courseNo))
    .limit(1);
  return result.length > 0;
}

export async function createCourse(course: InsertCourse) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    const result = await db.insert(courses).values({
      courseNo: course.courseNo,
      name: course.name,
      teacherId: course.teacherId,
      description: course.description || null,
      semester: course.semester,
      status: course.status,
    });
    return result;
  } catch (error: any) {
    // 重新抛出错误，让调用者处理
    if (error.code === 'ER_DUP_ENTRY' || error.sqlState === '23000') {
      const dupError = new Error(`课程号已存在`);
      (dupError as any).code = 'DUPLICATE_COURSE_NO';
      throw dupError;
    }
    throw error;
  }
}

export async function getCourseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCoursesByTeacherId(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      id: courses.id,
      courseNo: courses.courseNo,
      name: courses.name,
      description: courses.description,
      semester: courses.semester,
      teacherId: courses.teacherId,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      studentCount: sql<number>`COUNT(DISTINCT ${courseStudents.studentId})`.as('studentCount'),
    })
    .from(courses)
    .leftJoin(courseStudents, eq(courses.id, courseStudents.courseId))
    .where(eq(courses.teacherId, teacherId))
    .groupBy(courses.id)
    .orderBy(desc(courses.createdAt));
}

export async function getAllCourses() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      id: courses.id,
      courseNo: courses.courseNo,
      name: courses.name,
      description: courses.description,
      semester: courses.semester,
      teacherId: courses.teacherId,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      studentCount: sql<number>`COUNT(DISTINCT ${courseStudents.studentId})`.as('studentCount'),
    })
    .from(courses)
    .leftJoin(courseStudents, eq(courses.id, courseStudents.courseId))
    .groupBy(courses.id)
    .orderBy(desc(courses.createdAt));
}

export async function updateCourse(id: number, course: Partial<InsertCourse>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(courses).set(course).where(eq(courses.id, id));
}

export async function deleteCourse(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(courses).where(eq(courses.id, id));
}

// ============ 课程预约管理（Phase 4 P1）============

export async function createCourseReservation(reservation: InsertCourseReservation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(courseReservations).values(reservation);
  return result;
}

export async function getCourseReservationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(courseReservations).where(eq(courseReservations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCourseReservationsByCourse(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 只返回有效的预约（pending, approved, completed），排除已取消和已拒绝的
  return await db
    .select()
    .from(courseReservations)
    .where(
      and(
        eq(courseReservations.courseId, courseId),
        or(
          eq(courseReservations.status, 'pending'),
          eq(courseReservations.status, 'approved'),
          eq(courseReservations.status, 'completed')
        )
      )
    )
    .orderBy(desc(courseReservations.createdAt));
}

export async function getAllCourseReservationsByCourse(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 返回所有预约（包括已取消和已拒绝的），用于教师管理
  return await db
    .select()
    .from(courseReservations)
    .where(eq(courseReservations.courseId, courseId))
    .orderBy(desc(courseReservations.createdAt));
}

export async function updateCourseReservation(id: number, reservation: Partial<InsertCourseReservation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(courseReservations).set(reservation).where(eq(courseReservations.id, id));
}

// ============ 课程学生管理（Phase 4 P1）============

export async function addStudentToCourse(courseId: number, studentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(courseStudents).values({
    courseId,
    studentId,
    status: 'enrolled',
  });
}

export async function getCourseStudents(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      id: courseStudents.id,
      studentId: courseStudents.studentId,
      studentName: users.name,
      studentOpenId: users.openId,
      status: courseStudents.status,
      joinedAt: courseStudents.createdAt,
    })
    .from(courseStudents)
    .leftJoin(users, eq(courseStudents.studentId, users.id))
    .where(eq(courseStudents.courseId, courseId))
    .orderBy(courseStudents.createdAt);
}

export async function removeStudentFromCourse(courseId: number, studentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(courseStudents)
    .where(and(eq(courseStudents.courseId, courseId), eq(courseStudents.studentId, studentId)));
}

export async function getStudentCourses(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db
    .select({
      id: courses.id,
      courseNo: courses.courseNo,
      name: courses.name,
      teacherId: courses.teacherId,
      teacherName: users.name,
      semester: courses.semester,
      status: courses.status,
    })
    .from(courseStudents)
    .leftJoin(courses, eq(courseStudents.courseId, courses.id))
    .leftJoin(users, eq(courses.teacherId, users.id))
    .where(eq(courseStudents.studentId, studentId))
    .orderBy(desc(courses.createdAt));
  
  // 使用 Map 根据 courseId 去重，保留最后一条
  const uniqueCourses = Array.from(
    new Map(results.map(course => [course.id, course])).values()
  );
  
  return uniqueCourses;
}

// ============ 开放规则管理（Phase 4 P1）============

export async function createOpeningRule(rule: InsertOpeningRule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(openingRules).values(rule);
}

export async function getOpeningRulesForLab(labId?: number) {
  const db = await getDb();
  if (!db) return [];

  // 如果未指定实验室，仅返回全局规则（配置页“全局规则”使用）
  if (!labId) {
    return await db
      .select()
      .from(openingRules)
      .where(or(isNull(openingRules.labId), eq(openingRules.labId, 0)))
      .orderBy(openingRules.dayOfWeek);
  }

  // 实验室视角：按“实验室专属规则优先，其次按天级别回退全局规则”合并
  const [labRules, globalRules] = await Promise.all([
    db
      .select()
      .from(openingRules)
      .where(eq(openingRules.labId, labId))
      .orderBy(openingRules.dayOfWeek),
    db
      .select()
      .from(openingRules)
      .where(or(isNull(openingRules.labId), eq(openingRules.labId, 0)))
      .orderBy(openingRules.dayOfWeek),
  ]);

  if (labRules.length === 0) {
    // 没有任何专属规则时，完全回退到全局规则
    return globalRules;
  }

  const labDays = new Set(labRules.map((r: any) => r.dayOfWeek));
  const merged: any[] = [...labRules];

  // 只对“尚未配置实验室专属规则的星期几”追加全局规则，实现按天级别的兜底
  for (const g of globalRules as any[]) {
    if (!labDays.has(g.dayOfWeek)) {
      merged.push(g);
    }
  }

  // 按 dayOfWeek 排序，方便前端展示
  merged.sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0));

  return merged;
}

export async function updateOpeningRule(id: number, rule: Partial<InsertOpeningRule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(openingRules).set(rule).where(eq(openingRules.id, id));
}

// ============ 禁用时段管理（Phase 4 P1）============

export async function createBlockedPeriod(period: InsertBlockedPeriod) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(blockedPeriods).values(period);
}

export async function getBlockedPeriods(filters: { labId?: number; deviceId?: number; includeInactive?: boolean } = {}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters.labId !== undefined) conditions.push(eq(blockedPeriods.labId, filters.labId));
  if (filters.deviceId !== undefined) conditions.push(eq(blockedPeriods.deviceId, filters.deviceId));
  if (!filters.includeInactive) conditions.push(eq(blockedPeriods.status, 'active'));
  
  if (conditions.length === 0) {
    return await db.select().from(blockedPeriods).orderBy(desc(blockedPeriods.startDate));
  }
  
  return await db.select().from(blockedPeriods).where(and(...conditions)).orderBy(desc(blockedPeriods.startDate));
}

export async function getActiveBlockedPeriods(date: Date, labId?: number, deviceId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(blockedPeriods.status, 'active'),
    lte(blockedPeriods.startDate, date),
    gte(blockedPeriods.endDate, date),
  ];
  
  if (labId !== undefined) {
    // 检查实验室特定禁用或全局禁用（labId为NULL）
    conditions.push(
      or(
        eq(blockedPeriods.labId, labId),
        sql`${blockedPeriods.labId} IS NULL`
      )
    );
  }
  if (deviceId !== undefined) conditions.push(eq(blockedPeriods.deviceId, deviceId));
  
  return await db.select().from(blockedPeriods).where(and(...conditions));
}

/**
 * 获取与指定时间段重叠的禁用时段
 * 用于预约验证
 */
export async function getOverlappingBlockedPeriods(
  startTime: Date, 
  endTime: Date, 
  labId?: number, 
  deviceId?: number
) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(blockedPeriods.status, 'active'),
    // 时间重叠检测: NOT (end_new <= start_exist OR start_new >= end_exist)
    sql`NOT (${blockedPeriods.endDate} <= ${startTime} OR ${blockedPeriods.startDate} >= ${endTime})`
  ];
  
  if (labId !== undefined) {
    // 检查实验室特定禁用或全局禁用（labId为NULL）
    conditions.push(
      or(
        eq(blockedPeriods.labId, labId),
        sql`${blockedPeriods.labId} IS NULL`
      )
    );
  }
  if (deviceId !== undefined) conditions.push(eq(blockedPeriods.deviceId, deviceId));
  
  return await db.select().from(blockedPeriods).where(and(...conditions));
}

export async function updateBlockedPeriod(id: number, period: Partial<InsertBlockedPeriod>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(blockedPeriods).set(period).where(eq(blockedPeriods.id, id));
}

// ============ 班级管理（Classes）============

export async function createClass(classData: InsertClass) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(classes).values(classData);
  return result;
}

export async function getClassById(classId: number) {
  const db = await getDb();
  if (!db) return null;
  return await db.select().from(classes).where(eq(classes.id, classId)).then(rows => rows[0]);
}

export async function getAllClasses() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(classes).orderBy(desc(classes.createdAt));
}

export async function getClassesByStatus(status: 'active' | 'archived') {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(classes).where(eq(classes.status, status)).orderBy(desc(classes.createdAt));
}

export async function updateClass(classId: number, classData: Partial<InsertClass>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(classes).set(classData).where(eq(classes.id, classId));
}

// ============ 班级学生管理（Class Students）============

export async function addStudentToClass(classId: number, studentId: number, studentNo?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(classStudents).values({
    classId,
    studentId,
    studentNo,
    status: 'active',
  });
}

export async function getClassStudents(classId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      id: classStudents.id,
      studentId: classStudents.studentId,
      studentNo: classStudents.studentNo,
      status: classStudents.status,
      studentName: users.name,
      studentOpenId: users.openId,
    })
    .from(classStudents)
    .leftJoin(users, eq(classStudents.studentId, users.id))
    .where(eq(classStudents.classId, classId))
    .orderBy(classStudents.createdAt);
}

export async function getStudentClass(studentId: number) {
  const db = await getDb();
  if (!db) return null;
  return await db
    .select({
      classId: classStudents.classId,
      className: classes.name,
      classNo: classes.classNo,
    })
    .from(classStudents)
    .leftJoin(classes, eq(classStudents.classId, classes.id))
    .where(eq(classStudents.studentId, studentId))
    .then(rows => rows[0]);
}

export async function removeStudentFromClass(classId: number, studentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(classStudents)
    .where(and(eq(classStudents.classId, classId), eq(classStudents.studentId, studentId)));
}

export async function updateClassStudent(classId: number, studentId: number, data: Partial<InsertClassStudent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(classStudents)
    .set(data)
    .where(and(eq(classStudents.classId, classId), eq(classStudents.studentId, studentId)));
}

/**
 * 自动取消超时未签到的预约
 * 扫描所有状态为"approved"的预约，检查是否超过autoCancelHours
 */
export async function autoCancelOverdueReservations() {
  const db = await getDb();
  if (!db) return { cancelledCount: 0 };

  try {
    const now = new Date();
    
    // 获取所有已批准的预约
    const approvedReservations = await db
      .select()
      .from(labReservations)
      .where(eq(labReservations.status, "approved"));

    let cancelledCount = 0;

    for (const reservation of approvedReservations) {
      // 获取该实验室的审批配置
      const config = await getApprovalConfigForLab(reservation.labId);
      
      if (!config || !config.autoCancelHours || Number(config.autoCancelHours) <= 0) {
        continue; // 未启用自动取消
      }

      const autoCancelHours = Number(config.autoCancelHours);
      const startTime = new Date(reservation.startTime);
      const cancelDeadline = new Date(startTime.getTime() + autoCancelHours * 60 * 60 * 1000);

      // 如果当前时间已超过取消截止时间
      if (now > cancelDeadline) {
        // 更新预约状态为已取消
        await db
          .update(labReservations)
          .set({
            status: "cancelled",
            updatedAt: new Date(),
          })
          .where(eq(labReservations.id, reservation.id));

        // 记录违约（如果启用了违约系统）
        try {
          await recordViolation({
            userId: reservation.userId,
            reservationId: reservation.id,
            violationType: "no_show",
            description: `未按时签到，系统于 ${now.toISOString()} 自动取消预约`,
            points: 1,
          });
        } catch (err) {
          // 如果违约记录失败，只记录日志，不中断流程
          console.error("Failed to record violation:", err);
        }

        cancelledCount++;
      }
    }

    return { cancelledCount };
  } catch (error) {
    console.error("Error in autoCancelOverdueReservations:", error);
    return { cancelledCount: 0 };
  }
}

// ============ 日历与调度相关函数 ============

export async function getReservationsByTimeRange(input: {
  startDate: string;
  endDate: string;
  labId?: number;
  deviceId?: number;
  courseId?: number;
  teacherId?: number;
  status?: string;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const startTime = new Date(input.startDate);
    const endTime = new Date(input.endDate);

    const conditions: any[] = [
      gte(labReservations.startTime, startTime),
      lte(labReservations.endTime, endTime),
    ];

    if (input.labId) {
      conditions.push(eq(labReservations.labId, input.labId));
    }

    // TODO: 支持 deviceId 和 courseId 筛选（需要先执行数据库迁移）
    // if (input.deviceId) {
    //   conditions.push(eq(labReservations.deviceId, input.deviceId));
    // }
    // if (input.courseId) {
    //   conditions.push(eq(labReservations.courseId, input.courseId));
    // }

    if (input.status) {
      conditions.push(eq(labReservations.status, input.status as "pending" | "approved" | "rejected" | "completed" | "cancelled" | "violated"));
    }

    const reservations = await db
      .select({
        id: labReservations.id,
        userId: labReservations.userId,
        labId: labReservations.labId,
        labName: labRooms.name,
        startTime: labReservations.startTime,
        endTime: labReservations.endTime,
        status: labReservations.status,
        title: labReservations.title,
      })
      .from(labReservations)
      .leftJoin(labRooms, eq(labReservations.labId, labRooms.id))
      .where(and(...conditions));

    return reservations;
  } catch (error) {
    console.error("Error in getReservationsByTimeRange:", error);
    return [];
  }
}

export async function getLabCalendarData(input: {
  labId: number;
  startDate: string;
  endDate: string;
  viewType: 'day' | 'week' | 'month' | 'heatmap';
}): Promise<{
  events: any[];
  blockedPeriods: any[];
  summary: { totalReservations: number; approved: number; pending: number };
}> {
  const db = await getDb();
  if (!db) return { events: [], blockedPeriods: [], summary: { totalReservations: 0, approved: 0, pending: 0 } };

  try {
    const startTime = new Date(input.startDate);
    const endTime = new Date(input.endDate);

    const events = await db
      .select({
        id: labReservations.id,
        userId: labReservations.userId,
        startTime: labReservations.startTime,
        endTime: labReservations.endTime,
        status: labReservations.status,
        title: labReservations.title,
      })
      .from(labReservations)
      .where(
        and(
          eq(labReservations.labId, input.labId),
          gte(labReservations.startTime, startTime),
          lte(labReservations.endTime, endTime)
        )
      );

    // 获取禁用时段：查询与时间范围有重叠的禁用时段
    const blockedPeriodsList = await db
      .select({
        id: blockedPeriods.id,
        labId: blockedPeriods.labId,
        deviceId: blockedPeriods.deviceId,
        reason: blockedPeriods.reason,
        startDate: blockedPeriods.startDate,
        endDate: blockedPeriods.endDate,
        handleExisting: blockedPeriods.handleExisting,
        status: blockedPeriods.status,
      })
      .from(blockedPeriods)
      .where(
        and(
          eq(blockedPeriods.status, 'active'),
          or(
            eq(blockedPeriods.labId, input.labId),
            sql`${blockedPeriods.labId} IS NULL` // 全局禁用时段
          ),
          // 时间重叠检测: NOT (endDate <= startTime OR startDate >= endTime)
          sql`NOT (${blockedPeriods.endDate} <= ${startTime} OR ${blockedPeriods.startDate} >= ${endTime})`
        )
      );

    return {
      events,
      blockedPeriods: blockedPeriodsList,
      summary: {
        totalReservations: events.length,
        approved: events.filter(e => e.status === 'approved').length,
        pending: events.filter(e => e.status === 'pending').length,
      },
    };
  } catch (error) {
    console.error("Error in getLabCalendarData:", error);
    return { events: [], blockedPeriods: [], summary: { totalReservations: 0, approved: 0, pending: 0 } };
  }
}

/**
 * 获取月度资源利用率数据（按天统计）
 * 用于热力图显示
 */
export async function getMonthlyUtilizationData(input: {
  labId?: number;
  deviceId?: number;
  courseId?: number;
  startDate: string;
  endDate: string;
}): Promise<Array<{ date: string; count: number; hours: number }>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const startTime = new Date(input.startDate);
    const endTime = new Date(input.endDate);

    const conditions = [];
    
    if (input.labId) {
      conditions.push(eq(labReservations.labId, input.labId));
    }
    
    if (input.deviceId) {
      // 如果指定了设备，需要通过 reservation_devices 关联表查询
      // 这里简化处理，先只支持实验室维度
    }
    
    // 注意：lab_reservations 表没有 courseId 字段
    // 课程预约在 course_reservations 表中，这里暂时不支持按课程查询利用率
    // if (input.courseId) {
    //   conditions.push(eq(labReservations.courseId, input.courseId));
    // }

    // 只统计已批准和待审核的预约
    conditions.push(
      or(
        eq(labReservations.status, "approved"),
        eq(labReservations.status, "pending")
      )
    );

    // 查询时间范围内的预约
    conditions.push(
      and(
        gte(labReservations.startTime, startTime),
        lte(labReservations.endTime, endTime)
      )
    );

    // 按天分组统计
    const results = await db
      .select({
        date: sql<string>`DATE(${labReservations.startTime})`.as('date'),
        count: sql<number>`COUNT(*)`.as('count'),
        hours: sql<number>`SUM(TIMESTAMPDIFF(HOUR, ${labReservations.startTime}, ${labReservations.endTime}))`.as('hours'),
      })
      .from(labReservations)
      .where(and(...conditions))
      .groupBy(sql`DATE(${labReservations.startTime})`);

    return results.map((r: any) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      count: Number(r.count) || 0,
      hours: Number(r.hours) || 0,
    }));
  } catch (error) {
    console.error("Error in getMonthlyUtilizationData:", error);
    return [];
  }
}

export async function getCourseCalendarByTeacher(
  teacherId: number,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const startTime = new Date(startDate);
    const endTime = new Date(endDate);

    const reservations = await db
      .select({
        id: courseReservations.id,
        courseId: courseReservations.courseId,
        courseName: courses.name,
        labId: courseReservations.labId,
        labName: labRooms.name,
        startTime: courseReservations.startTime,
        endTime: courseReservations.endTime,
        status: courseReservations.status,
      })
      .from(courseReservations)
      .innerJoin(courses, eq(courseReservations.courseId, courses.id))
      .leftJoin(labRooms, eq(courseReservations.labId, labRooms.id))
      .where(
        and(
          eq(courses.teacherId, teacherId),
          gte(courseReservations.startTime, startTime),
          lte(courseReservations.endTime, endTime)
        )
      );

    return reservations;
  } catch (error) {
    console.error("Error in getCourseCalendarByTeacher:", error);
    return [];
  }
}

export async function getAlternativeTimeSlots(input: {
  labId: number;
  startTime: string;
  endTime: string;
  excludeReservationId?: number;
}): Promise<Array<{ startTime: Date; endTime: Date; availableCapacity: number; confidence: number }>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const requestedStart = new Date(input.startTime);
    const requestedEnd = new Date(input.endTime);
    const duration = requestedEnd.getTime() - requestedStart.getTime();

    // 获取实验室容量
    const lab = await db
      .select({ capacity: labRooms.capacity })
      .from(labRooms)
      .where(eq(labRooms.id, input.labId))
      .limit(1);

    if (!lab || !lab[0]) return [];

    const labCapacity = lab[0].capacity || 0;

    // 获取 ADVANCE_DAYS 规则
    const advanceRule = await db
      .select({ ruleValue: labReserveRules.ruleValue })
      .from(labReserveRules)
      .where(
        and(
          eq(labReserveRules.ruleCode, 'ADVANCE_DAYS'),
          eq(labReserveRules.status, 'enabled')
        )
      )
      .limit(1);

    const advanceDays = advanceRule && advanceRule[0] ? parseInt(advanceRule[0].ruleValue, 10) : 0;
    const now = new Date();
    const minAllowedDate = new Date(now);
    minAllowedDate.setDate(minAllowedDate.getDate() + advanceDays);
    minAllowedDate.setHours(0, 0, 0, 0);

    // 搜索未来 30 天
    const searchEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 获取所有已有预约
    const reservations = await db
      .select({
        startTime: labReservations.startTime,
        endTime: labReservations.endTime,
      })
      .from(labReservations)
      .where(
        and(
          eq(labReservations.labId, input.labId),
          or(
            eq(labReservations.status, "approved"),
            eq(labReservations.status, "pending")
          ),
          gte(labReservations.endTime, now),
          lte(labReservations.startTime, searchEnd),
          input.excludeReservationId 
            ? sql`${labReservations.id} != ${input.excludeReservationId}`
            : sql`1=1`
        )
      );

    const suggestions: Array<{ startTime: Date; endTime: Date; availableCapacity: number; confidence: number }> = [];

    // 智能生成时间建议：优先考虑最近的、同时间段的
    const candidates: Array<{ start: Date; end: Date; confidence: number }> = [];

    // 1. 同天其他时间段（往后每小时）
    for (let hour = 1; hour <= 12; hour++) {
      const newStart = new Date(requestedStart.getTime() + hour * 60 * 60 * 1000);
      const newEnd = new Date(newStart.getTime() + duration);
      
      // 确保在工作时间内 (6:00-22:00)
      if (newStart.getHours() >= 6 && newStart.getHours() <= 21) {
        candidates.push({ start: newStart, end: newEnd, confidence: 0.95 - hour * 0.02 });
      }
    }

    // 2. 次日及后续天数的同时间段
    for (let day = 1; day <= 21; day++) {
      const newStart = new Date(requestedStart);
      newStart.setDate(newStart.getDate() + day);
      const newEnd = new Date(newStart.getTime() + duration);
      
      candidates.push({ start: newStart, end: newEnd, confidence: 0.90 - day * 0.01 });
    }

    // 3. 同天早些时间（如果原时间较晚）
    if (requestedStart.getHours() > 10) {
      for (let hour = 1; hour <= 6; hour++) {
        const newStart = new Date(requestedStart.getTime() - hour * 60 * 60 * 1000);
        const newEnd = new Date(newStart.getTime() + duration);
        
        if (newStart.getHours() >= 6) {
          candidates.push({ start: newStart, end: newEnd, confidence: 0.85 - hour * 0.02 });
        }
      }
    }

    // 4. 分析已有预约之间的空闲时段
    if (reservations.length > 0) {
      const sortedReservations = [...reservations].sort((a, b) => 
        a.startTime.getTime() - b.startTime.getTime()
      );
      
      // 检查每两个预约之间的空隙
      for (let i = 0; i < sortedReservations.length - 1; i++) {
        const gapStart = sortedReservations[i].endTime;
        const gapEnd = sortedReservations[i + 1].startTime;
        const gapDuration = gapEnd.getTime() - gapStart.getTime();
        
        // 如果空隙足够大
        if (gapDuration >= duration) {
          const newStart = new Date(gapStart);
          const newEnd = new Date(newStart.getTime() + duration);
          
          // 确保在工作时间
          if (newStart.getHours() >= 6 && newEnd.getHours() <= 22) {
            candidates.push({ 
              start: newStart, 
              end: newEnd, 
              confidence: 0.92 // 利用空闲时段有较高优先级
            });
          }
        }
      }
    }

    // 检查每个候选时间是否可用
    for (const candidate of candidates) {
      const { start: newStart, end: newEnd, confidence } = candidate;

      // 检查是否符合提前预约规则
      if (newStart < minAllowedDate) {
        continue;
      }

      // 检查是否有冲突
      const hasConflict = reservations.some(
        r => !(newEnd <= r.startTime || newStart >= r.endTime)
      );

      if (!hasConflict) {
        suggestions.push({
          startTime: newStart,
          endTime: newEnd,
          availableCapacity: labCapacity,
          confidence: confidence,
        });

        // 找到 5 个建议就停止
        if (suggestions.length >= 5) break;
      }
    }

    // 如果没有找到建议，记录原因
    if (suggestions.length === 0) {
      console.log('[AlternativeSlots] No suggestions found:', {
        labId: input.labId,
        requestedTime: `${requestedStart.toISOString()} - ${requestedEnd.toISOString()}`,
        minAllowedDate: minAllowedDate.toISOString(),
        candidatesChecked: candidates.length,
        existingReservations: reservations.length,
      });
    }

    return suggestions;
  } catch (error) {
    console.error("Error in getAlternativeTimeSlots:", error);
    return [];
  }
}

// 获取预约详情（包含关联信息）
export async function getReservationDetails(reservationId: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    // 获取基本预约信息
    const [reservation] = await db
      .select()
      .from(labReservations)
      .where(eq(labReservations.id, reservationId))
      .limit(1);

    if (!reservation) return undefined;

    // 获取申请人信息
    const [applicant] = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, reservation.userId))
      .limit(1);

    // 获取实验室信息
    const [lab] = await db
      .select()
      .from(labRooms)
      .where(eq(labRooms.id, reservation.labId))
      .limit(1);

    // 获取审批历史
    const approvalHistory = await db
      .select({
        id: approvalHistories.id,
        approverUserId: approvalHistories.approverUserId,
        approvalStage: approvalHistories.approvalStage,
        decision: approvalHistories.decision,
        comment: approvalHistories.comment,
        approvedAt: approvalHistories.approvedAt,
      })
      .from(approvalHistories)
      .where(eq(approvalHistories.reservationId, reservationId))
      .orderBy(approvalHistories.approvalStage);

    return {
      ...reservation,
      applicant,
      lab,
      devices: [], // 设备列表需要单独的关联表，暂时返回空数组
      course: null, // 课程信息（当前schema中预约表没有courseId字段）
      approvalHistory,
    };
  } catch (error) {
    console.error("Error in getReservationDetails:", error);
    return undefined;
  }
}
