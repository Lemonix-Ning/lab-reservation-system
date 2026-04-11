import { and, desc, eq, gte, lte, or, sql, lt, gt, ne, isNull, isNotNull, asc, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { InsertLabReservation, InsertLabRoom, InsertLabReserveRule, InsertUser, InsertLabDevice, InsertNotification, labReservations, labRooms, labReserveRules, users, labDevices, notifications, approvalConfigs, approvalHistories, violationRecords, blacklist, auditLogs, InsertApprovalConfig, InsertApprovalHistory, InsertViolationRecord, InsertBlacklist, InsertAuditLog, courses, courseReservations, courseStudents, openingRules, blockedPeriods, InsertCourse, InsertCourseReservation, InsertCourseStudent, InsertOpeningRule, InsertBlockedPeriod, classes, classStudents, InsertClass, InsertClassStudent, labGeofences, InsertLabGeofence, periodTimeMapping, semesterConfigs, courseSchedules, checkinSessions, courseAttendances, InsertPeriodTimeMapping, InsertSemesterConfig, InsertCourseSchedule, InsertCheckinSession, InsertCourseAttendance, rolePermissions, InsertRolePermission, userRoleWhitelist, roleUpgradeRequests } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const base = process.env.DATABASE_URL;
      const url = base!.includes("?") ? `${base}&timezone=Z` : `${base}?timezone=Z`;
      const pool = mysql.createPool(url);
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

export async function getLabGeofence(labId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(labGeofences)
    .where(and(eq(labGeofences.labId, labId), eq(labGeofences.status, "enabled")))
    .orderBy(desc(labGeofences.updatedAt))
    .limit(1);
  return rows[0];
}

export async function listLabGeofences(labId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (labId === undefined) {
    return await db.select().from(labGeofences).orderBy(desc(labGeofences.updatedAt));
  }
  return await db.select().from(labGeofences).where(eq(labGeofences.labId, labId)).orderBy(desc(labGeofences.updatedAt));
}

export async function createLabGeofence(geo: InsertLabGeofence) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(labGeofences).values(geo);
}

export async function updateLabGeofence(id: number, geo: Partial<InsertLabGeofence>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(labGeofences).set(geo).where(eq(labGeofences.id, id));
}

export async function deleteLabGeofence(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(labGeofences).where(eq(labGeofences.id, id));
}

export function calculateDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    2 *
    Math.asin(
      Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng)
    );
  return R * c;
}

export async function checkinReservation(reservationId: number, params: { method: 'qrcode' | 'geofence' | 'manual'; latitude?: number; longitude?: number; deviceInfo?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const reservation = await getReservationById(reservationId);
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "approved") {
    return { success: false, reason: "预约状态不可签到" as const };
  }
  const now = new Date();
  const windowStart = new Date(reservation.startTime.getTime() - 15 * 60 * 1000);
  
  if (now < windowStart || now > reservation.endTime) {
    return { success: false, reason: "不在签到时间窗口内" as const };
  }
  if (reservation.checkinTime) {
    return { success: false, reason: "已签到" as const };
  }
  
  // 确定最终签到方式
  let finalMethod = params.method;
  
  if (params.method === "geofence") {
    if (params.latitude === undefined || params.longitude === undefined) {
      // 没有位置信息，降级为手动签到
      finalMethod = "manual";
    } else {
      const gf = await getLabGeofence(reservation.labId);
      if (!gf) {
        // 未配置围栏，降级为手动签到（但保留位置信息）
        finalMethod = "manual";
      } else {
        const d = calculateDistance(
          { lat: params.latitude, lng: params.longitude },
          { lat: Number(gf.latitude), lng: Number(gf.longitude) }
        );
        if (d > gf.radius) {
          return { success: false, reason: `超出围栏范围（距离${Math.round(d)}米，允许${gf.radius}米）` as const };
        }
        // 位置验证通过，使用 geofence 方式
      }
    }
  }
  
  await db
    .update(labReservations)
    .set({
      checkinTime: now,
      checkinMethod: finalMethod,
      checkinLatitude: params.latitude === undefined ? null : String(params.latitude),
      checkinLongitude: params.longitude === undefined ? null : String(params.longitude),
      checkinDeviceInfo: params.deviceInfo,
      updatedAt: now,
    })
    .where(eq(labReservations.id, reservationId));
  return { success: true as const, method: finalMethod };
}

export async function checkoutReservation(reservationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const reservation = await getReservationById(reservationId);
  if (!reservation) throw new Error("Reservation not found");
  const now = new Date();
  if (!reservation.checkinTime) {
    return { success: false, reason: "未签到" as const };
  }
  if (reservation.checkoutTime) {
    return { success: false, reason: "已签退" as const };
  }
  if (now < reservation.startTime) {
    return { success: false, reason: "未到预约开始时间" as const };
  }

  // 检查是否超时签退（超过预约结束时间30分钟）
  const endTime = new Date(reservation.endTime);
  const timeoutThreshold = 30 * 60 * 1000; // 30分钟
  const isTimeout = now.getTime() > (endTime.getTime() + timeoutThreshold);

  await db
    .update(labReservations)
    .set({
      checkoutTime: now,
      status: reservation.status === "approved" ? "completed" : reservation.status,
      updatedAt: now,
    })
    .where(eq(labReservations.id, reservationId));

  // 如果超时签退，自动记录违约
  if (isTimeout) {
    try {
      const overtimeMinutes = Math.floor((now.getTime() - endTime.getTime()) / (60 * 1000));
      await recordViolation({
        userId: reservation.userId,
        reservationId: reservation.id,
        violationType: "timeout_checkout",
        description: `超时 ${overtimeMinutes} 分钟签退`,
        points: 3,
      });
    } catch (err) {
      console.error("Failed to record timeout violation:", err);
    }
  }

  return { success: true as const, isTimeout };
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

export async function updateUserRole(id: number, role: 'student' | 'teacher' | 'labAdmin' | 'sysAdmin') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function updateUser(id: number, data: { name?: string; email?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, id));
}

/**
 * 注销用户账号（软删除或硬删除）
 * 注意：这会删除用户的所有关联数据
 */
export async function deleteUserAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 使用事务确保数据一致性
  await db.transaction(async (tx) => {
    // 1. 删除 OAuth 绑定
    const { userOAuthBindings } = await import("../drizzle/schema");
    await tx.delete(userOAuthBindings).where(eq(userOAuthBindings.userId, userId));

    // 2. 删除用户的预约记录（可选：改为匿名化）
    // 注意：这里直接删除，如果需要保留历史记录可以改为软删除
    await tx.delete(labReservations).where(eq(labReservations.userId, userId));

    // 3. 删除通知
    await tx.delete(notifications).where(eq(notifications.userId, userId));

    // 4. 删除违约记录
    await tx.delete(violationRecords).where(eq(violationRecords.userId, userId));

    // 5. 删除黑名单记录
    await tx.delete(blacklist).where(eq(blacklist.userId, userId));

    // 6. 删除课程学生关联（如果是学生）
    await tx.delete(courseStudents).where(eq(courseStudents.studentId, userId));

    // 7. 删除班级学生关联
    await tx.delete(classStudents).where(eq(classStudents.studentId, userId));

    // 8. 删除课程出勤记录
    const { courseAttendances } = await import("../drizzle/schema");
    await tx.delete(courseAttendances).where(eq(courseAttendances.studentId, userId));

    // 9. 处理课程（如果是教师）
    // 注意：不删除课程，而是将其标记为归档或转移给其他教师
    const userCourses = await tx.select().from(courses).where(eq(courses.teacherId, userId));
    if (userCourses.length > 0) {
      // 将课程标记为归档
      await tx.update(courses)
        .set({ status: "archived" })
        .where(eq(courses.teacherId, userId));
    }

    // 10. 处理签到会话（如果是教师）
    const { checkinSessions } = await import("../drizzle/schema");
    await tx.update(checkinSessions)
      .set({ status: "closed" })
      .where(eq(checkinSessions.teacherId, userId));

    // 11. 审计日志保留（不删除，用于审计追踪）
    // 注意：审计日志通常不应该删除，以保持审计追踪

    // 12. 最后删除用户记录
    await tx.delete(users).where(eq(users.id, userId));
  });
}

// ============ OAuth 绑定管理 ============

export async function getUserByOAuthBinding(provider: string, providerUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const { userOAuthBindings } = await import("../drizzle/schema");
  
  const result = await db
    .select({ user: users })
    .from(userOAuthBindings)
    .innerJoin(users, eq(userOAuthBindings.userId, users.id))
    .where(
      and(
        eq(userOAuthBindings.provider, provider as any),
        eq(userOAuthBindings.providerUserId, providerUserId),
        eq(userOAuthBindings.status, "active")
      )
    )
    .limit(1);

  return result.length > 0 ? result[0].user : undefined;
}

export async function createOAuthBinding(data: {
  userId: number;
  provider: string;
  providerUserId: string;
  providerEmail?: string | null;
  providerName?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userOAuthBindings } = await import("../drizzle/schema");
  
  await db.insert(userOAuthBindings).values({
    userId: data.userId,
    provider: data.provider as any,
    providerUserId: data.providerUserId,
    providerEmail: data.providerEmail || null,
    providerName: data.providerName || null,
    accessToken: data.accessToken || null,
    refreshToken: data.refreshToken || null,
    tokenExpiresAt: data.tokenExpiresAt || null,
    lastUsedAt: new Date(),
  });
}

export async function updateOAuthBinding(
  provider: string,
  providerUserId: string,
  data: {
    accessToken?: string | null;
    refreshToken?: string | null;
    tokenExpiresAt?: Date | null;
    lastUsedAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userOAuthBindings } = await import("../drizzle/schema");
  
  await db
    .update(userOAuthBindings)
    .set(data)
    .where(
      and(
        eq(userOAuthBindings.provider, provider as any),
        eq(userOAuthBindings.providerUserId, providerUserId)
      )
    );
}

export async function getUserOAuthBindings(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { userOAuthBindings } = await import("../drizzle/schema");
  
  return await db
    .select()
    .from(userOAuthBindings)
    .where(
      and(
        eq(userOAuthBindings.userId, userId),
        eq(userOAuthBindings.status, "active")
      )
    )
    .orderBy(desc(userOAuthBindings.lastUsedAt));
}

export async function unbindOAuth(userId: number, provider: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { userOAuthBindings } = await import("../drizzle/schema");
  
  await db
    .update(userOAuthBindings)
    .set({ status: "unbound" })
    .where(
      and(
        eq(userOAuthBindings.userId, userId),
        eq(userOAuthBindings.provider, provider as any)
      )
    );
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

export async function getLabRoomByNo(roomNo: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(labRooms).where(eq(labRooms.roomNo, roomNo)).limit(1);
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
    const qRaw = opts.q.trim();
    if (qRaw.length >= 3) {
      whereClauses.push(sql`MATCH(${labReservations.title}, ${labReservations.reason}) AGAINST (${qRaw} IN NATURAL LANGUAGE MODE)`);
    } else {
      const q = `%${qRaw}%`;
      whereClauses.push(sql`(${labReservations.title} LIKE ${q} OR ${labReservations.reason} LIKE ${q})`);
    }
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

export async function getCourseByNo(courseNo: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(courses).where(eq(courses.courseNo, courseNo)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateCourse(id: number, data: {
  courseNo?: string;
  name?: string;
  description?: string | null;
  semester?: string;
  status?: 'active' | 'archived';
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(courses).set(data).where(eq(courses.id, id));
}

export async function deleteCourse(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 先删除相关的课程学生关联
  await db.delete(courseStudents).where(eq(courseStudents.courseId, id));
  // 删除课程
  await db.delete(courses).where(eq(courses.id, id));
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

/**
 * 获取待审批的课程预约
 */
export async function getPendingCourseReservations(labId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(courseReservations.status, 'pending')];
  if (labId) {
    conditions.push(eq(courseReservations.labId, labId));
  }
  
  return await db
    .select({
      id: courseReservations.id,
      courseId: courseReservations.courseId,
      courseName: courses.name,
      courseNo: courses.courseNo,
      teacherId: courses.teacherId,
      teacherName: users.name,
      labId: courseReservations.labId,
      labName: labRooms.name,
      title: courseReservations.title,
      reason: courseReservations.reason,
      startTime: courseReservations.startTime,
      endTime: courseReservations.endTime,
      status: courseReservations.status,
      createdAt: courseReservations.createdAt,
    })
    .from(courseReservations)
    .leftJoin(courses, eq(courseReservations.courseId, courses.id))
    .leftJoin(users, eq(courses.teacherId, users.id))
    .leftJoin(labRooms, eq(courseReservations.labId, labRooms.id))
    .where(and(...conditions))
    .orderBy(desc(courseReservations.createdAt));
}

/**
 * 审批通过课程预约
 */
export async function approveCourseReservation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  await db.update(courseReservations).set({
    status: 'approved',
    approveTime: new Date(),
  }).where(eq(courseReservations.id, id));
}

/**
 * 拒绝课程预约
 */
export async function rejectCourseReservation(id: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  await db.update(courseReservations).set({
    status: 'rejected',
    rejectReason: reason || null,
  }).where(eq(courseReservations.id, id));
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
    conditions.push(sql`(${blockedPeriods.labId} = ${labId} OR ${blockedPeriods.labId} IS NULL)`);
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
    conditions.push(sql`(${blockedPeriods.labId} = ${labId} OR ${blockedPeriods.labId} IS NULL)`);
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
            points: 5,
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

/**
 * 自动检测超时未签退的预约并记录违约
 * 扫描所有已签到但未签退的预约，检查是否超过结束时间30分钟
 */
export async function autoDetectTimeoutCheckout() {
  const db = await getDb();
  if (!db) return { violationCount: 0 };

  try {
    const now = new Date();
    const timeoutThreshold = 30 * 60 * 1000; // 30分钟
    
    // 获取所有已签到但未签退的预约
    const checkedInReservations = await db
      .select()
      .from(labReservations)
      .where(
        and(
          isNotNull(labReservations.checkinTime),
          isNull(labReservations.checkoutTime),
          eq(labReservations.status, "approved")
        )
      );

    let violationCount = 0;

    for (const reservation of checkedInReservations) {
      const endTime = new Date(reservation.endTime);
      const timeoutDeadline = new Date(endTime.getTime() + timeoutThreshold);

      // 如果当前时间已超过超时截止时间
      if (now > timeoutDeadline) {
        // 检查是否已经记录过该预约的超时违约
        const existingViolation = await db
          .select()
          .from(violationRecords)
          .where(
            and(
              eq(violationRecords.reservationId, reservation.id),
              eq(violationRecords.violationType, "timeout_checkout")
            )
          )
          .limit(1);

        if (existingViolation.length === 0) {
          // 记录违约
          try {
            const overtimeMinutes = Math.floor((now.getTime() - endTime.getTime()) / (60 * 1000));
            await recordViolation({
              userId: reservation.userId,
              reservationId: reservation.id,
              violationType: "timeout_checkout",
              description: `超时 ${overtimeMinutes} 分钟未签退，系统自动记录`,
              points: 3,
            });
            violationCount++;
          } catch (err) {
            console.error("Failed to record timeout violation:", err);
          }
        }
      }
    }

    return { violationCount };
  } catch (error) {
    console.error("Error in autoDetectTimeoutCheckout:", error);
    return { violationCount: 0 };
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

// ============ 课堂签到相关方法 ============

/**
 * 获取所有节次时间映射
 */
export async function getPeriodTimeMapping() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(periodTimeMapping).orderBy(periodTimeMapping.periodNo);
}

/**
 * 创建节次时间映射（幂等）
 */
export async function createPeriodTimeMapping(data: InsertPeriodTimeMapping) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [result] = await db.insert(periodTimeMapping).values(data);
  return result.insertId;
}

/**
 * 更新节次时间映射
 */
export async function updatePeriodTimeMapping(id: number, data: Partial<InsertPeriodTimeMapping>) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(periodTimeMapping).set(data).where(eq(periodTimeMapping.id, id));
}

/**
 * 删除节次时间映射
 */
export async function deletePeriodTimeMapping(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(periodTimeMapping).where(eq(periodTimeMapping.id, id));
}

/**
 * 获取当前学期配置
 */
export async function getCurrentSemester() {
  const db = await getDb();
  if (!db) return null;
  const [semester] = await db
    .select()
    .from(semesterConfigs)
    .where(eq(semesterConfigs.isCurrent, 1))
    .limit(1);
  return semester || null;
}

/**
 * 获取所有学期配置
 */
export async function getAllSemesters() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(semesterConfigs).orderBy(desc(semesterConfigs.startDate));
}

/**
 * 创建签到会话
 */
export async function createCheckinSession(session: InsertCheckinSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [result] = await db.insert(checkinSessions).values(session);
  return result.insertId;
}

/**
 * 获取签到会话详情
 */
export async function getCheckinSessionById(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const [session] = await db
    .select()
    .from(checkinSessions)
    .where(eq(checkinSessions.id, sessionId))
    .limit(1);
  return session || null;
}

/**
 * 获取课程的活跃签到会话
 */
export async function getActiveCheckinSession(courseId: number) {
  const db = await getDb();
  if (!db) return null;
  const [session] = await db
    .select()
    .from(checkinSessions)
    .where(and(
      eq(checkinSessions.courseId, courseId),
      eq(checkinSessions.status, 'active')
    ))
    .orderBy(desc(checkinSessions.startedAt))
    .limit(1);
  return session || null;
}

/**
 * 根据二维码令牌获取签到会话
 */
export async function getCheckinSessionByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const [session] = await db
    .select()
    .from(checkinSessions)
    .where(and(
      eq(checkinSessions.qrcodeToken, token),
      eq(checkinSessions.status, 'active')
    ))
    .limit(1);
  return session || null;
}

/**
 * 更新签到会话
 */
export async function updateCheckinSession(sessionId: number, data: Partial<InsertCheckinSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(checkinSessions).set(data).where(eq(checkinSessions.id, sessionId));
}

/**
 * 关闭签到会话
 */
export async function closeCheckinSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  // 统计出勤人数
  const stats = await db
    .select({
      status: courseAttendances.status,
      count: sql<number>`count(*)`,
    })
    .from(courseAttendances)
    .where(eq(courseAttendances.sessionId, sessionId))
    .groupBy(courseAttendances.status);
  
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  
  for (const s of stats) {
    if (s.status === 'present') presentCount = Number(s.count);
    else if (s.status === 'late') lateCount = Number(s.count);
    else if (s.status === 'absent') absentCount = Number(s.count);
  }
  
  await db.update(checkinSessions).set({
    status: 'closed',
    closedAt: new Date(),
    presentCount,
    lateCount,
    absentCount,
  }).where(eq(checkinSessions.id, sessionId));
}

/**
 * 初始化课程出勤记录（为所有学生创建缺勤记录）
 */
export async function initCourseAttendances(sessionId: number, courseId: number, sessionDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  // 获取课程所有学生
  const students = await db
    .select({ studentId: courseStudents.studentId })
    .from(courseStudents)
    .where(and(
      eq(courseStudents.courseId, courseId),
      eq(courseStudents.status, 'enrolled')
    ));
  
  // 批量插入缺勤记录
  if (students.length > 0) {
    const values = students.map(s => ({
      sessionId,
      courseId,
      studentId: s.studentId,
      sessionDate,
      status: 'absent' as const,
    }));
    
    // 使用 INSERT IGNORE 避免重复
    await db.insert(courseAttendances).values(values).onDuplicateKeyUpdate({
      set: { sessionId: sql`VALUES(sessionId)` } // 保持原值不变
    });
  }
  
  return students.length;
}

/**
 * 学生签到
 */
export async function studentCheckin(params: {
  sessionId: number;
  studentId: number;
  method: 'qrcode' | 'geofence' | 'manual';
  latitude?: number;
  longitude?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  const session = await getCheckinSessionById(params.sessionId);
  if (!session) throw new Error("签到会话不存在");
  if (session.status !== 'active') throw new Error("签到已结束");
  
  // 计算是否迟到
  const now = new Date();
  const startedAt = new Date(session.startedAt!);
  const lateThreshold = session.allowLateMinutes || 15;
  const minutesLate = (now.getTime() - startedAt.getTime()) / 60000;
  const status = minutesLate > lateThreshold ? 'late' : 'present';
  
  // 更新出勤记录
  await db.update(courseAttendances).set({
    checkinTime: now,
    checkinMethod: params.method,
    checkinLatitude: params.latitude?.toString(),
    checkinLongitude: params.longitude?.toString(),
    status,
  }).where(and(
    eq(courseAttendances.sessionId, params.sessionId),
    eq(courseAttendances.studentId, params.studentId)
  ));
  
  return { status, minutesLate: Math.floor(minutesLate) };
}

/**
 * 教师手动更新学生出勤状态
 */
export async function updateAttendanceStatus(sessionId: number, studentId: number, status: 'present' | 'late' | 'absent' | 'leave', note?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  await db.update(courseAttendances).set({
    status,
    note,
    checkinMethod: 'manual',
    checkinTime: status === 'present' || status === 'late' ? new Date() : null,
  }).where(and(
    eq(courseAttendances.sessionId, sessionId),
    eq(courseAttendances.studentId, studentId)
  ));
}

/**
 * 获取签到会话的出勤列表
 */
export async function getSessionAttendances(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      id: courseAttendances.id,
      studentId: courseAttendances.studentId,
      studentName: users.name,
      status: courseAttendances.status,
      checkinTime: courseAttendances.checkinTime,
      checkinMethod: courseAttendances.checkinMethod,
      note: courseAttendances.note,
    })
    .from(courseAttendances)
    .leftJoin(users, eq(courseAttendances.studentId, users.id))
    .where(eq(courseAttendances.sessionId, sessionId))
    .orderBy(courseAttendances.status, users.name);
}

/**
 * 获取学生某课程的出勤记录
 */
export async function getStudentCourseAttendances(studentId: number, courseId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      id: courseAttendances.id,
      sessionId: courseAttendances.sessionId,
      sessionDate: courseAttendances.sessionDate,
      status: courseAttendances.status,
      checkinTime: courseAttendances.checkinTime,
      checkinMethod: courseAttendances.checkinMethod,
      note: courseAttendances.note,
      weekNo: checkinSessions.weekNo,
      title: checkinSessions.title,
    })
    .from(courseAttendances)
    .leftJoin(checkinSessions, eq(courseAttendances.sessionId, checkinSessions.id))
    .where(and(
      eq(courseAttendances.studentId, studentId),
      eq(courseAttendances.courseId, courseId)
    ))
    .orderBy(desc(courseAttendances.sessionDate));
}

/**
 * 获取课程出勤统计
 */
export async function getCourseAttendanceStats(courseId: number) {
  const db = await getDb();
  if (!db) return { sessions: 0, students: 0, avgRate: 0 };
  
  // 总签到会话数
  const [sessionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(checkinSessions)
    .where(eq(checkinSessions.courseId, courseId));
  
  // 学生出勤统计
  const studentStats = await db
    .select({
      studentId: courseAttendances.studentId,
      present: sql<number>`SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)`,
      late: sql<number>`SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END)`,
      absent: sql<number>`SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)`,
      leave: sql<number>`SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END)`,
      total: sql<number>`count(*)`,
    })
    .from(courseAttendances)
    .where(eq(courseAttendances.courseId, courseId))
    .groupBy(courseAttendances.studentId);
  
  const sessions = Number(sessionCount?.count || 0);
  const students = studentStats.length;
  
  // 计算平均出勤率
  let totalPresent = 0;
  let totalRecords = 0;
  for (const s of studentStats) {
    totalPresent += Number(s.present) + Number(s.late) * 0.5; // 迟到算半次
    totalRecords += Number(s.total);
  }
  const avgRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
  
  return { sessions, students, avgRate, details: studentStats };
}

/**
 * 获取教师的签到会话历史
 */
export async function getTeacherCheckinHistory(teacherId: number, courseId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(checkinSessions.teacherId, teacherId)];
  if (courseId) conditions.push(eq(checkinSessions.courseId, courseId));
  
  return await db
    .select({
      id: checkinSessions.id,
      courseId: checkinSessions.courseId,
      courseName: courses.name,
      labId: checkinSessions.labId,
      labName: labRooms.name,
      sessionDate: checkinSessions.sessionDate,
      weekNo: checkinSessions.weekNo,
      title: checkinSessions.title,
      status: checkinSessions.status,
      startedAt: checkinSessions.startedAt,
      closedAt: checkinSessions.closedAt,
      presentCount: checkinSessions.presentCount,
      lateCount: checkinSessions.lateCount,
      absentCount: checkinSessions.absentCount,
    })
    .from(checkinSessions)
    .leftJoin(courses, eq(checkinSessions.courseId, courses.id))
    .leftJoin(labRooms, eq(checkinSessions.labId, labRooms.id))
    .where(and(...conditions))
    .orderBy(desc(checkinSessions.sessionDate));
}

/**
 * 获取学生当前可签到的课程
 */
export async function getStudentActiveCheckins(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  
  console.log('[DEBUG] getStudentActiveCheckins - studentId:', studentId);
  
  // 获取学生选的课程
  const enrolledCourses = await db
    .select({ courseId: courseStudents.courseId })
    .from(courseStudents)
    .where(and(
      eq(courseStudents.studentId, studentId),
      eq(courseStudents.status, 'enrolled')
    ));
  
  console.log('[DEBUG] enrolledCourses:', enrolledCourses);
  
  if (enrolledCourses.length === 0) {
    console.log('[DEBUG] 学生没有选修任何课程');
    return [];
  }
  
  const courseIds = enrolledCourses.map(c => c.courseId);
  console.log('[DEBUG] courseIds:', courseIds);
  
  // 获取这些课程的活跃签到会话
  const activeSessions = await db
    .select({
      sessionId: checkinSessions.id,
      courseId: checkinSessions.courseId,
      courseName: courses.name,
      labId: checkinSessions.labId,
      labName: labRooms.name,
      title: checkinSessions.title,
      startedAt: checkinSessions.startedAt,
      allowLateMinutes: checkinSessions.allowLateMinutes,
      useGeofence: checkinSessions.useGeofence,
    })
    .from(checkinSessions)
    .leftJoin(courses, eq(checkinSessions.courseId, courses.id))
    .leftJoin(labRooms, eq(checkinSessions.labId, labRooms.id))
    .where(and(
      eq(checkinSessions.status, 'active'),
      inArray(checkinSessions.courseId, courseIds)
    ));
  
  console.log('[DEBUG] activeSessions (before hasCheckedIn):', activeSessions);
  
  // 为每个会话检查学生是否已签到
  const sessionsWithCheckin = await Promise.all(
    activeSessions.map(async (session) => {
      const [attendance] = await db
        .select({ id: courseAttendances.id })
        .from(courseAttendances)
        .where(and(
          eq(courseAttendances.sessionId, session.sessionId),
          eq(courseAttendances.studentId, studentId),
          or(
            eq(courseAttendances.status, 'present'),
            eq(courseAttendances.status, 'late')
          )
        ))
        .limit(1);
      
      return {
        ...session,
        hasCheckedIn: attendance ? 1 : 0,
      };
    })
  );
  
  console.log('[DEBUG] activeSessions:', sessionsWithCheckin);
  
  return sessionsWithCheckin;
}

// ===================== 课程排课管理 =====================

/**
 * 获取课程的排课安排
 */
export async function getCourseSchedules(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      id: courseSchedules.id,
      courseId: courseSchedules.courseId,
      labId: courseSchedules.labId,
      labName: labRooms.name,
      dayOfWeek: courseSchedules.dayOfWeek,
      startPeriod: courseSchedules.startPeriod,
      endPeriod: courseSchedules.endPeriod,
      startWeek: courseSchedules.startWeek,
      endWeek: courseSchedules.endWeek,
      weekType: courseSchedules.weekType,
    })
    .from(courseSchedules)
    .leftJoin(labRooms, eq(courseSchedules.labId, labRooms.id))
    .where(eq(courseSchedules.courseId, courseId))
    .orderBy(courseSchedules.dayOfWeek, courseSchedules.startPeriod);
}

/**
 * 获取所有已审批通过的排课（课表视图用）
 */
export async function getAllApprovedSchedules(labId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(courseSchedules.status, 'approved')];
  if (labId) {
    conditions.push(eq(courseSchedules.labId, labId));
  }
  
  return await db
    .select({
      id: courseSchedules.id,
      courseId: courseSchedules.courseId,
      courseName: courses.name,
      courseNo: courses.courseNo,
      teacherName: users.name,
      labId: courseSchedules.labId,
      labName: labRooms.name,
      labRoomNo: labRooms.roomNo,
      dayOfWeek: courseSchedules.dayOfWeek,
      startPeriod: courseSchedules.startPeriod,
      endPeriod: courseSchedules.endPeriod,
      startWeek: courseSchedules.startWeek,
      endWeek: courseSchedules.endWeek,
      weekType: courseSchedules.weekType,
    })
    .from(courseSchedules)
    .leftJoin(courses, eq(courseSchedules.courseId, courses.id))
    .leftJoin(users, eq(courses.teacherId, users.id))
    .leftJoin(labRooms, eq(courseSchedules.labId, labRooms.id))
    .where(and(...conditions))
    .orderBy(courseSchedules.dayOfWeek, courseSchedules.startPeriod);
}

/**
 * 添加课程排课
 */
export async function addCourseSchedule(schedule: InsertCourseSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [result] = await db.insert(courseSchedules).values(schedule);
  return result.insertId;
}

/**
 * 更新课程排课
 */
export async function updateCourseSchedule(id: number, data: Partial<InsertCourseSchedule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(courseSchedules).set(data).where(eq(courseSchedules.id, id));
}

/**
 * 删除课程排课
 */
export async function deleteCourseSchedule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(courseSchedules).where(eq(courseSchedules.id, id));
}

/**
 * 获取单个排课信息
 */
export async function getScheduleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [schedule] = await db.select().from(courseSchedules).where(eq(courseSchedules.id, id)).limit(1);
  return schedule || null;
}

/**
 * 获取待审批的排课列表
 */
export async function getPendingSchedules(labId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(courseSchedules.status, 'pending')];
  if (labId) {
    conditions.push(eq(courseSchedules.labId, labId));
  }
  
  return await db
    .select({
      id: courseSchedules.id,
      courseId: courseSchedules.courseId,
      courseName: courses.name,
      courseNo: courses.courseNo,
      teacherId: courses.teacherId,
      teacherName: users.name,
      labId: courseSchedules.labId,
      labName: labRooms.name,
      dayOfWeek: courseSchedules.dayOfWeek,
      startPeriod: courseSchedules.startPeriod,
      endPeriod: courseSchedules.endPeriod,
      startWeek: courseSchedules.startWeek,
      endWeek: courseSchedules.endWeek,
      weekType: courseSchedules.weekType,
      status: courseSchedules.status,
      createdAt: courseSchedules.createdAt,
    })
    .from(courseSchedules)
    .leftJoin(courses, eq(courseSchedules.courseId, courses.id))
    .leftJoin(users, eq(courses.teacherId, users.id))
    .leftJoin(labRooms, eq(courseSchedules.labId, labRooms.id))
    .where(and(...conditions))
    .orderBy(desc(courseSchedules.createdAt));
}

/**
 * 审批通过排课
 */
export async function approveSchedule(id: number, approverId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  await db.update(courseSchedules).set({
    status: 'approved',
    approvedAt: new Date(),
    approvedBy: approverId,
  }).where(eq(courseSchedules.id, id));
}

/**
 * 拒绝排课
 */
export async function rejectSchedule(id: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  await db.update(courseSchedules).set({
    status: 'rejected',
    rejectReason: reason || null,
  }).where(eq(courseSchedules.id, id));
}

/**
 * 检查排课冲突
 */
export async function checkScheduleConflict(params: {
  labId: number;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  startWeek: number;
  endWeek: number;
  weekType: 'all' | 'odd' | 'even';
  excludeId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db
    .select({
      id: courseSchedules.id,
      courseName: courses.name,
      dayOfWeek: courseSchedules.dayOfWeek,
      startPeriod: courseSchedules.startPeriod,
      endPeriod: courseSchedules.endPeriod,
      startWeek: courseSchedules.startWeek,
      endWeek: courseSchedules.endWeek,
      weekType: courseSchedules.weekType,
    })
    .from(courseSchedules)
    .leftJoin(courses, eq(courseSchedules.courseId, courses.id))
    .where(and(
      eq(courseSchedules.labId, params.labId),
      eq(courseSchedules.dayOfWeek, params.dayOfWeek),
      // 节次重叠
      sql`${courseSchedules.startPeriod} <= ${params.endPeriod}`,
      sql`${courseSchedules.endPeriod} >= ${params.startPeriod}`,
      // 周次重叠
      sql`${courseSchedules.startWeek} <= ${params.endWeek}`,
      sql`${courseSchedules.endWeek} >= ${params.startWeek}`,
      // 排除自身
      params.excludeId ? sql`${courseSchedules.id} != ${params.excludeId}` : sql`1=1`
    ));
  
  const conflicts = await query;
  
  // 进一步过滤周类型冲突
  return conflicts.filter(c => {
    if (params.weekType === 'all' || c.weekType === 'all') return true;
    return params.weekType === c.weekType;
  });
}

// ===================== 学期配置管理 =====================

/**
 * 创建学期配置
 */
export async function createSemester(data: InsertSemesterConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  // 如果设为当前学期，先取消其他学期的当前标记
  if (data.isCurrent) {
    await db.update(semesterConfigs).set({ isCurrent: 0 });
  }
  
  const [result] = await db.insert(semesterConfigs).values(data);
  return result.insertId;
}

/**
 * 更新学期配置
 */
export async function updateSemester(id: number, data: Partial<InsertSemesterConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  
  // 如果设为当前学期，先取消其他学期的当前标记
  if (data.isCurrent) {
    await db.update(semesterConfigs).set({ isCurrent: 0 });
  }
  
  await db.update(semesterConfigs).set(data).where(eq(semesterConfigs.id, id));
}

/**
 * 删除学期配置
 */
export async function deleteSemester(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(semesterConfigs).where(eq(semesterConfigs.id, id));
}

/**
 * 根据学期配置计算第N周对应的日期范围
 */
export function calculateWeekDates(semesterStartDate: Date, weekNo: number): { start: Date; end: Date } {
  const start = new Date(semesterStartDate);
  start.setDate(start.getDate() + (weekNo - 1) * 7);
  // 调整到周一
  const dayOfWeek = start.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + daysToMonday);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  
  return { start, end };
}

/**
 * 计算给定日期是第几周
 */
export function calculateCurrentWeek(semesterStartDate: Date, targetDate: Date = new Date()): number {
  const start = new Date(semesterStartDate);
  // 调整到周一
  const dayOfWeek = start.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + daysToMonday);
  
  const diffTime = targetDate.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

// ===================== P0: 排课与预约冲突检测 =====================

/**
 * 将节次转换为具体时间
 * @param date 日期
 * @param periodNo 节次号
 * @param isEnd 是否为结束时间
 */
export async function periodToTime(date: Date, periodNo: number, isEnd: boolean = false): Promise<Date> {
  const periods = await getPeriodTimeMapping();
  const period = periods.find(p => p.periodNo === periodNo);
  if (!period) {
    throw new Error(`节次 ${periodNo} 不存在`);
  }
  
  const timeStr = isEnd ? period.endTime : period.startTime;
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * 检查个人预约是否与课程排课冲突
 * 在创建/修改个人预约时调用
 */
export async function checkReservationConflictWithSchedule(
  labId: number,
  startTime: Date,
  endTime: Date
): Promise<{ hasConflict: boolean; conflicts: any[] }> {
  const db = await getDb();
  if (!db) return { hasConflict: false, conflicts: [] };
  
  // 获取当前学期
  const semester = await getCurrentSemester();
  if (!semester) {
    // 无学期配置，不检查课程冲突
    return { hasConflict: false, conflicts: [] };
  }
  
  // 获取节次时间映射
  const periods = await getPeriodTimeMapping();
  if (periods.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }
  
  // 计算预约日期对应的周次和星期
  const weekNo = calculateCurrentWeek(semester.startDate, startTime);
  const dayOfWeek = startTime.getDay() === 0 ? 7 : startTime.getDay(); // 转换为1-7
  
  // 如果周次超出学期范围，不检查
  if (weekNo < 1 || weekNo > (semester.weekCount || 20)) {
    return { hasConflict: false, conflicts: [] };
  }
  
  // 提取预约的时间范围 (HH:MM)
  const reserveStartHour = startTime.getHours();
  const reserveStartMin = startTime.getMinutes();
  const reserveEndHour = endTime.getHours();
  const reserveEndMin = endTime.getMinutes();
  
  // 查询该实验室、该星期、该周次范围内的课程排课
  const schedules = await db
    .select({
      id: courseSchedules.id,
      courseId: courseSchedules.courseId,
      courseName: courses.name,
      startPeriod: courseSchedules.startPeriod,
      endPeriod: courseSchedules.endPeriod,
      startWeek: courseSchedules.startWeek,
      endWeek: courseSchedules.endWeek,
      weekType: courseSchedules.weekType,
      status: courseSchedules.status,
    })
    .from(courseSchedules)
    .leftJoin(courses, eq(courseSchedules.courseId, courses.id))
    .where(and(
      eq(courseSchedules.labId, labId),
      eq(courseSchedules.dayOfWeek, dayOfWeek),
      sql`${courseSchedules.startWeek} <= ${weekNo}`,
      sql`${courseSchedules.endWeek} >= ${weekNo}`,
      or(
        eq(courseSchedules.status, 'pending'),
        eq(courseSchedules.status, 'approved')
      )
    ));
  
  // 过滤周类型
  const validSchedules = schedules.filter(s => {
    if (s.weekType === 'all') return true;
    if (s.weekType === 'odd' && weekNo % 2 === 1) return true;
    if (s.weekType === 'even' && weekNo % 2 === 0) return true;
    return false;
  });
  
  // 检查时间重叠
  const conflicts: any[] = [];
  for (const schedule of validSchedules) {
    // 获取课程的开始和结束时间
    const scheduleStartPeriod = periods.find(p => p.periodNo === schedule.startPeriod);
    const scheduleEndPeriod = periods.find(p => p.periodNo === schedule.endPeriod);
    
    if (!scheduleStartPeriod || !scheduleEndPeriod) continue;
    
    const [scheduleStartHour, scheduleStartMin] = scheduleStartPeriod.startTime.split(':').map(Number);
    const [scheduleEndHour, scheduleEndMin] = scheduleEndPeriod.endTime.split(':').map(Number);
    
    // 转换为分钟进行比较
    const reserveStartMins = reserveStartHour * 60 + reserveStartMin;
    const reserveEndMins = reserveEndHour * 60 + reserveEndMin;
    const scheduleStartMins = scheduleStartHour * 60 + scheduleStartMin;
    const scheduleEndMins = scheduleEndHour * 60 + scheduleEndMin;
    
    // 检查时间重叠
    if (!(reserveEndMins <= scheduleStartMins || reserveStartMins >= scheduleEndMins)) {
      conflicts.push({
        type: 'course_schedule',
        scheduleId: schedule.id,
        courseName: schedule.courseName,
        startPeriod: schedule.startPeriod,
        endPeriod: schedule.endPeriod,
        timeRange: `${scheduleStartPeriod.startTime}-${scheduleEndPeriod.endTime}`,
      });
    }
  }
  
  return { hasConflict: conflicts.length > 0, conflicts };
}

/**
 * 检查课程排课是否与个人预约冲突
 * 在添加/修改课程排课时调用
 */
export async function checkScheduleConflictWithReservation(params: {
  labId: number;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  startWeek: number;
  endWeek: number;
  weekType: 'all' | 'odd' | 'even';
}): Promise<{ hasConflict: boolean; conflicts: any[] }> {
  const db = await getDb();
  if (!db) return { hasConflict: false, conflicts: [] };
  
  // 获取当前学期
  const semester = await getCurrentSemester();
  if (!semester) {
    return { hasConflict: false, conflicts: [] };
  }
  
  // 获取节次时间映射
  const periods = await getPeriodTimeMapping();
  const startPeriodInfo = periods.find(p => p.periodNo === params.startPeriod);
  const endPeriodInfo = periods.find(p => p.periodNo === params.endPeriod);
  
  if (!startPeriodInfo || !endPeriodInfo) {
    return { hasConflict: false, conflicts: [] };
  }
  
  const [scheduleStartHour, scheduleStartMin] = startPeriodInfo.startTime.split(':').map(Number);
  const [scheduleEndHour, scheduleEndMin] = endPeriodInfo.endTime.split(':').map(Number);
  
  const conflicts: any[] = [];
  
  // 遍历每个周次检查冲突
  for (let weekNo = params.startWeek; weekNo <= params.endWeek; weekNo++) {
    // 检查周类型
    if (params.weekType === 'odd' && weekNo % 2 === 0) continue;
    if (params.weekType === 'even' && weekNo % 2 === 1) continue;
    
    // 计算该周对应的日期
    const weekDates = calculateWeekDates(semester.startDate, weekNo);
    const targetDate = new Date(weekDates.start);
    targetDate.setDate(targetDate.getDate() + params.dayOfWeek - 1); // dayOfWeek 1=周一
    
    // 构造具体时间
    const scheduleStart = new Date(targetDate);
    scheduleStart.setHours(scheduleStartHour, scheduleStartMin, 0, 0);
    
    const scheduleEnd = new Date(targetDate);
    scheduleEnd.setHours(scheduleEndHour, scheduleEndMin, 0, 0);
    
    // 查询冲突的预约
    const conflictingReservations = await getConflictingReservations(
      params.labId,
      scheduleStart,
      scheduleEnd
    );
    
    for (const r of conflictingReservations) {
      conflicts.push({
        type: 'reservation',
        reservationId: r.id,
        title: r.title,
        startTime: r.startTime,
        endTime: r.endTime,
        weekNo,
      });
    }
  }
  
  return { hasConflict: conflicts.length > 0, conflicts };
}

// ============ 角色权限管理 ============

// 所有可用权限定义
export const ALL_PERMISSIONS = [
  { code: 'lab:manage', name: '实验室管理', description: '创建、编辑、删除实验室' },
  { code: 'device:manage', name: '设备管理', description: '管理实验室设备' },
  { code: 'reservation:approve', name: '预约审批', description: '审批个人预约申请' },
  { code: 'schedule:approve', name: '排课审批', description: '审批课程排课申请' },
  { code: 'course:manage', name: '课程管理', description: '创建和管理课程' },
  { code: 'rule:manage', name: '规则管理', description: '管理预约规则和开放规则' },
  { code: 'user:manage', name: '用户管理', description: '管理用户角色' },
  { code: 'statistics:view', name: '统计查看', description: '查看统计数据' },
  { code: 'violation:manage', name: '违约管理', description: '管理违约记录和黑名单' },
  { code: 'audit:view', name: '审计日志', description: '查看审计日志' },
  { code: 'geofence:manage', name: '地理围栏管理', description: '管理实验室地理围栏' },
  { code: 'class:manage', name: '班级管理', description: '管理班级信息' },
  { code: 'checkin:teacher', name: '教师签到', description: '发起课堂签到' },
  { code: 'system:settings', name: '系统设置', description: '系统配置管理' },
] as const;

export type PermissionCode = typeof ALL_PERMISSIONS[number]['code'];

/**
 * 获取角色的所有权限配置
 */
export async function getRolePermissions(role: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role as any));
}

/**
 * 获取所有角色的权限配置
 */
export async function getAllRolePermissions() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(rolePermissions).orderBy(rolePermissions.role, rolePermissions.permissionCode);
}

/**
 * 检查用户是否有某项权限
 */
export async function hasPermission(userId: number, permissionCode: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // 获取用户角色
  const user = await getUserById(userId);
  if (!user) return false;
  
  // sysAdmin 始终拥有所有权限
  if (user.role === 'sysAdmin') return true;
  
  // 查询该角色是否有此权限
  const result = await db
    .select()
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.role, user.role as any),
        eq(rolePermissions.permissionCode, permissionCode),
        eq(rolePermissions.enabled, '1')
      )
    )
    .limit(1);
  
  return result.length > 0;
}

/**
 * 获取用户拥有的所有权限代码
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  const user = await getUserById(userId);
  if (!user) return [];
  
  // sysAdmin 拥有所有权限
  if (user.role === 'sysAdmin') {
    return ALL_PERMISSIONS.map(p => p.code);
  }
  
  const result = await db
    .select({ permissionCode: rolePermissions.permissionCode })
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.role, user.role as any),
        eq(rolePermissions.enabled, '1')
      )
    );
  
  return result.map(r => r.permissionCode);
}

/**
 * 设置角色权限（批量更新）
 */
export async function setRolePermissions(
  role: 'student' | 'teacher' | 'labAdmin',
  permissions: { code: string; enabled: boolean }[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const perm of permissions) {
    // 先尝试更新，如果不存在则插入
    const existing = await db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.role, role),
          eq(rolePermissions.permissionCode, perm.code)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      await db
        .update(rolePermissions)
        .set({ enabled: perm.enabled ? '1' : '0' })
        .where(eq(rolePermissions.id, existing[0].id));
    } else {
      await db.insert(rolePermissions).values({
        role,
        permissionCode: perm.code,
        enabled: perm.enabled ? '1' : '0',
      });
    }
  }
}

// ============ 角色白名单管理 ============

/**
 * 根据邮箱查询白名单
 */
export async function getWhitelistByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(userRoleWhitelist)
    .where(eq(userRoleWhitelist.email, email.toLowerCase()))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 获取所有白名单
 */
export async function getAllWhitelist() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(userRoleWhitelist).orderBy(desc(userRoleWhitelist.createdAt));
}

/**
 * 添加白名单
 */
export async function addWhitelist(data: {
  email: string;
  role: 'student' | 'teacher' | 'labAdmin' | 'sysAdmin';
  name?: string;
  department?: string;
  employeeNo?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(userRoleWhitelist).values({
    email: data.email.toLowerCase(),
    role: data.role,
    name: data.name,
    department: data.department,
    employeeNo: data.employeeNo,
  });
  
  return result[0].insertId;
}

/**
 * 批量添加白名单
 */
export async function batchAddWhitelist(items: {
  email: string;
  role: 'student' | 'teacher' | 'labAdmin' | 'sysAdmin';
  name?: string;
  department?: string;
  employeeNo?: string;
}[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];
  
  for (const item of items) {
    try {
      await db.insert(userRoleWhitelist).values({
        email: item.email.toLowerCase(),
        role: item.role,
        name: item.name,
        department: item.department,
        employeeNo: item.employeeNo,
      });
      successCount++;
    } catch (e: any) {
      failCount++;
      if (e.code === 'ER_DUP_ENTRY') {
        errors.push(`${item.email}: 已存在`);
      } else {
        errors.push(`${item.email}: ${e.message}`);
      }
    }
  }
  
  return { successCount, failCount, errors };
}

/**
 * 删除白名单
 */
export async function deleteWhitelist(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(userRoleWhitelist).where(eq(userRoleWhitelist.id, id));
}

// ============ 角色升级申请管理 ============

/**
 * 创建角色升级申请
 */
export async function createRoleUpgradeRequest(data: {
  userId: number;
  requestedRole: 'teacher' | 'labAdmin';
  reason?: string;
  department?: string;
  employeeNo?: string;
  proofUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 检查是否已有待处理的申请
  const existing = await db
    .select()
    .from(roleUpgradeRequests)
    .where(
      and(
        eq(roleUpgradeRequests.userId, data.userId),
        eq(roleUpgradeRequests.status, 'pending')
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    throw new Error("您已有待处理的申请，请等待审核");
  }
  
  const result = await db.insert(roleUpgradeRequests).values({
    userId: data.userId,
    requestedRole: data.requestedRole,
    reason: data.reason,
    department: data.department,
    employeeNo: data.employeeNo,
    proofUrl: data.proofUrl,
  });
  
  return result[0].insertId;
}

/**
 * 获取用户的角色申请记录
 */
export async function getUserRoleRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(roleUpgradeRequests)
    .where(eq(roleUpgradeRequests.userId, userId))
    .orderBy(desc(roleUpgradeRequests.createdAt));
}

/**
 * 获取所有待审核的角色申请
 */
export async function getPendingRoleRequests() {
  const db = await getDb();
  if (!db) return [];
  
  const requests = await db
    .select()
    .from(roleUpgradeRequests)
    .where(eq(roleUpgradeRequests.status, 'pending'))
    .orderBy(asc(roleUpgradeRequests.createdAt));
  
  // 获取用户信息
  const result = [];
  for (const req of requests) {
    const user = await getUserById(req.userId);
    result.push({
      ...req,
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
    });
  }
  
  return result;
}

/**
 * 获取所有角色申请（含历史）
 */
export async function getAllRoleRequests(params?: { status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(roleUpgradeRequests);
  
  if (params?.status) {
    query = query.where(eq(roleUpgradeRequests.status, params.status as any)) as any;
  }
  
  const requests = await query.orderBy(desc(roleUpgradeRequests.createdAt));
  
  // 获取用户信息
  const result = [];
  for (const req of requests) {
    const user = await getUserById(req.userId);
    const reviewer = req.reviewerId ? await getUserById(req.reviewerId) : null;
    result.push({
      ...req,
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
      reviewer: reviewer ? { id: reviewer.id, name: reviewer.name } : null,
    });
  }
  
  return result;
}

/**
 * 审核角色升级申请
 */
export async function reviewRoleRequest(
  requestId: number,
  reviewerId: number,
  approved: boolean,
  comment?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 获取申请信息
  const request = await db
    .select()
    .from(roleUpgradeRequests)
    .where(eq(roleUpgradeRequests.id, requestId))
    .limit(1);
  
  if (!request[0]) {
    throw new Error("申请不存在");
  }
  
  if (request[0].status !== 'pending') {
    throw new Error("该申请已处理");
  }
  
  // 更新申请状态
  await db.update(roleUpgradeRequests).set({
    status: approved ? 'approved' : 'rejected',
    reviewerId,
    reviewComment: comment,
    reviewedAt: new Date(),
  }).where(eq(roleUpgradeRequests.id, requestId));
  
  // 如果通过，更新用户角色
  if (approved) {
    await db.update(users).set({
      role: request[0].requestedRole,
    }).where(eq(users.id, request[0].userId));
  }
  
  return { success: true };
}

// ============ 3L 智能推荐算法已移至 server/db-3l.ts（暂未启用） ============