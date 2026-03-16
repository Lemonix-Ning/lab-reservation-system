import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { InsertLabReservation } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { xfspark } from "./_core/xfspark";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

// 简单的请求限流器（内存存储）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(key);
  
  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

// 获取客户端IP地址
function getClientIp(req: any): string | undefined {
  // 检查代理转发的IP头
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for 可能包含多个IP，取第一个
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return (ips[0] || '').trim();
  }
  
  // 检查其他可能的IP头
  const ip = req.headers['x-real-ip'] || 
             req.connection?.remoteAddress || 
             req.socket?.remoteAddress || 
             req.ip;
  
  return ip ? (typeof ip === 'string' ? ip : ip[0]) : undefined;
}

// 管理员权限检查（sysAdmin 和 labAdmin 都可以访问）
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['sysAdmin', 'labAdmin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理员权限' });
  }
  return next({ ctx });
});

// 系统管理员权限检查
const sysAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'sysAdmin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要系统管理员权限' });
  }
  return next({ ctx });
});

// 教师权限检查（支持动态权限）
const teacherProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // 角色检查
  if (['teacher', 'sysAdmin'].includes(ctx.user.role)) {
    return next({ ctx });
  }
  // 动态权限检查
  const hasPerm = await db.hasPermission(ctx.user.id, 'course:manage');
  if (hasPerm) {
    return next({ ctx });
  }
  throw new TRPCError({ code: 'FORBIDDEN', message: '需要教师权限' });
});

// 实验室管理员权限检查（支持动态权限）
const labAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // 角色检查
  if (['labAdmin', 'sysAdmin'].includes(ctx.user.role)) {
    return next({ ctx });
  }
  // 动态权限检查 - 检查是否有任意管理权限
  const adminPerms = ['lab:manage', 'device:manage', 'reservation:approve', 'schedule:approve', 
                       'rule:manage', 'statistics:view', 'violation:manage', 'audit:view', 'geofence:manage'];
  for (const perm of adminPerms) {
    if (await db.hasPermission(ctx.user.id, perm)) {
      return next({ ctx });
    }
  }
  throw new TRPCError({ code: 'FORBIDDEN', message: '需要实验室管理员权限' });
});

// 创建支持动态权限的 procedure 工厂
function createPermissionProcedure(permissionCode: string, fallbackRoles: string[] = []) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    // sysAdmin 始终有权限
    if (ctx.user.role === 'sysAdmin') {
      return next({ ctx });
    }
    // 检查备用角色
    if (fallbackRoles.includes(ctx.user.role)) {
      return next({ ctx });
    }
    // 检查动态权限
    const hasPerm = await db.hasPermission(ctx.user.id, permissionCode);
    if (hasPerm) {
      return next({ ctx });
    }
    throw new TRPCError({ code: 'FORBIDDEN', message: `需要 ${permissionCode} 权限` });
  });
}

// 预定义常用权限 procedure
const labManageProcedure = createPermissionProcedure('lab:manage', ['labAdmin']);
const deviceManageProcedure = createPermissionProcedure('device:manage', ['labAdmin']);
const reservationApproveProcedure = createPermissionProcedure('reservation:approve', ['labAdmin']);
const scheduleApproveProcedure = createPermissionProcedure('schedule:approve', ['labAdmin']);
const ruleManageProcedure = createPermissionProcedure('rule:manage', ['labAdmin']);
const statisticsViewProcedure = createPermissionProcedure('statistics:view', ['labAdmin']);
const violationManageProcedure = createPermissionProcedure('violation:manage', ['labAdmin']);
const auditViewProcedure = createPermissionProcedure('audit:view', ['labAdmin']);
const geofenceManageProcedure = createPermissionProcedure('geofence:manage', ['labAdmin']);
const classManageProcedure = createPermissionProcedure('class:manage', ['labAdmin']);
const checkinTeacherProcedure = createPermissionProcedure('checkin:teacher', ['teacher']);

function normalizeReason(reason: string): 'maintenance' | 'vacation' | 'inspection' | 'other' {
  const r = reason.trim().toLowerCase();
  const maintenance = ['maintenance','maintain','维护','年度维护','维保','检修','保养','维护期'];
  const vacation = ['vacation','holiday','假期','节假日','放假'];
  const inspection = ['inspection','inspect','年检','巡检','设备检查','检查'];
  if (maintenance.includes(r)) return 'maintenance';
  if (vacation.includes(r)) return 'vacation';
  if (inspection.includes(r)) return 'inspection';
  return r as any === 'maintenance' || r === 'vacation' || r === 'inspection' || r === 'other' ? (r as any) : 'other';
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ 用户管理 ============
  user: router({
    getAll: protectedProcedure
      .query(async ({ ctx }) => {
        // 教师只能看到学生，管理员可以看到所有用户
        const allUsers = await db.getAllUsers();
        if (ctx.user.role === 'teacher') {
          return allUsers.filter(u => u.role === 'student');
        }
        return allUsers;
      }),
    
    updateRole: adminProcedure
      .input(z.object({
        id: z.number(),
        role: z.enum(['student', 'teacher', 'labAdmin', 'sysAdmin']),
      }))
      .mutation(async ({ input, ctx }) => {
        // 不能修改自己的角色
        if (input.id === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '不能修改自己的角色' });
        }
        await db.updateUserRole(input.id, input.role);
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'user_role_update',
          targetType: 'user',
          targetId: input.id,
          details: JSON.stringify({ newRole: input.role }),
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateUser(id, data);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '不能删除自己' });
        }
        await db.deleteUser(input.id);
        return { success: true };
      }),
    
    // 用户自己注销账号
    deleteMyAccount: protectedProcedure
      .mutation(async ({ ctx }) => {
        const userId = ctx.user.id;
        
        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: userId,
          operationType: 'user_account_delete',
          targetType: 'user',
          targetId: userId,
          details: JSON.stringify({ 
            reason: 'User requested account deletion',
            timestamp: new Date().toISOString()
          }),
          ipAddress: getClientIp(ctx.req),
        });
        
        // 删除账号及所有关联数据
        await db.deleteUserAccount(userId);
        
        // 清除 Cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        
        return { success: true };
      }),
    
    // OAuth 绑定管理
    getOAuthBindings: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserOAuthBindings(ctx.user.id);
      }),
    
    unbindOAuth: protectedProcedure
      .input(z.object({
        provider: z.enum(['github', 'qq', 'school']),
      }))
      .mutation(async ({ input, ctx }) => {
        // 检查是否是最后一个绑定
        const bindings = await db.getUserOAuthBindings(ctx.user.id);
        if (bindings.length <= 1) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: '不能解绑最后一个账号，否则将无法登录' 
          });
        }
        
        await db.unbindOAuth(ctx.user.id, input.provider);
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'oauth_unbind',
          targetType: 'user',
          targetId: ctx.user.id,
          details: JSON.stringify({ provider: input.provider }),
          ipAddress: getClientIp(ctx.req),
        });
        
        return { success: true };
      }),
  }),

  // ============ 权限管理 ============
  permission: router({
    // 获取所有权限定义
    getAllDefinitions: protectedProcedure
      .query(async () => {
        return db.ALL_PERMISSIONS;
      }),

    // 获取当前用户的权限列表
    myPermissions: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserPermissions(ctx.user.id);
      }),

    // 检查当前用户是否有某项权限
    check: protectedProcedure
      .input(z.object({ permissionCode: z.string() }))
      .query(async ({ ctx, input }) => {
        return await db.hasPermission(ctx.user.id, input.permissionCode);
      }),

    // 获取所有角色的权限配置（仅系统管理员）
    getAll: sysAdminProcedure
      .query(async () => {
        const allPerms = await db.getAllRolePermissions();
        
        // 初始化所有角色的所有权限为 false
        const grouped: Record<string, Record<string, boolean>> = {
          student: {},
          teacher: {},
          labAdmin: {},
        };
        
        // 先用所有权限定义初始化为 false
        for (const role of ['student', 'teacher', 'labAdmin'] as const) {
          for (const perm of db.ALL_PERMISSIONS) {
            grouped[role][perm.code] = false;
          }
        }
        
        // 然后用数据库中的记录覆盖
        for (const p of allPerms) {
          if (p.role !== 'sysAdmin' && grouped[p.role]) {
            grouped[p.role][p.permissionCode] = p.enabled === '1';
          }
        }
        
        return {
          definitions: db.ALL_PERMISSIONS,
          rolePermissions: grouped,
        };
      }),

    // 更新角色权限（仅系统管理员）
    updateRole: sysAdminProcedure
      .input(z.object({
        role: z.enum(['student', 'teacher', 'labAdmin']),
        permissions: z.array(z.object({
          code: z.string(),
          enabled: z.boolean(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.setRolePermissions(input.role, input.permissions);
        
        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'permission_update',
          targetType: 'role',
          details: JSON.stringify({ role: input.role, permissions: input.permissions }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        return { success: true };
      }),
  }),

  // ============ 角色白名单管理 ============
  whitelist: router({
    // 获取所有白名单
    getAll: sysAdminProcedure
      .query(async () => {
        return await db.getAllWhitelist();
      }),

    // 添加白名单
    add: sysAdminProcedure
      .input(z.object({
        email: z.string().email(),
        role: z.enum(['student', 'teacher', 'labAdmin', 'sysAdmin']),
        name: z.string().optional(),
        department: z.string().optional(),
        employeeNo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.addWhitelist(input);
        
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'whitelist_add',
          targetType: 'whitelist',
          details: JSON.stringify(input),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        return { success: true, id };
      }),

    // 批量添加白名单
    batchAdd: sysAdminProcedure
      .input(z.object({
        items: z.array(z.object({
          email: z.string().email(),
          role: z.enum(['student', 'teacher', 'labAdmin', 'sysAdmin']),
          name: z.string().optional(),
          department: z.string().optional(),
          employeeNo: z.string().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.batchAddWhitelist(input.items);
        
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'whitelist_batch_add',
          targetType: 'whitelist',
          details: JSON.stringify({ count: input.items.length, result }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        return result;
      }),

    // 删除白名单
    delete: sysAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteWhitelist(input.id);
        
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'whitelist_delete',
          targetType: 'whitelist',
          details: JSON.stringify({ id: input.id }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        return { success: true };
      }),
  }),

  // ============ 角色升级申请 ============
  roleRequest: router({
    // 创建申请
    create: protectedProcedure
      .input(z.object({
        requestedRole: z.enum(['teacher', 'labAdmin']),
        reason: z.string().min(10, '申请理由至少10个字'),
        department: z.string().optional(),
        employeeNo: z.string().optional(),
        proofUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 检查当前角色
        if (ctx.user.role === 'sysAdmin') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '系统管理员无需申请' });
        }
        if (ctx.user.role === input.requestedRole) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '您已经是该角色' });
        }
        
        // 角色升级路径限制：student → teacher → labAdmin
        if (ctx.user.role === 'student' && input.requestedRole === 'labAdmin') {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: '学生需要先申请成为教师，才能申请实验室管理员' 
          });
        }
        if (ctx.user.role === 'labAdmin' && input.requestedRole === 'teacher') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '实验室管理员权限高于教师，无需降级' });
        }
        
        const id = await db.createRoleUpgradeRequest({
          userId: ctx.user.id,
          ...input,
        });
        
        return { success: true, id };
      }),

    // 获取我的申请记录
    myRequests: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserRoleRequests(ctx.user.id);
      }),

    // 获取待审核列表（管理员）
    getPending: sysAdminProcedure
      .query(async () => {
        return await db.getPendingRoleRequests();
      }),

    // 获取所有申请（管理员）
    getAll: sysAdminProcedure
      .input(z.object({
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getAllRoleRequests(input);
      }),

    // 审核申请（管理员）
    review: sysAdminProcedure
      .input(z.object({
        requestId: z.number(),
        approved: z.boolean(),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.reviewRoleRequest(
          input.requestId,
          ctx.user.id,
          input.approved,
          input.comment
        );
        
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: input.approved ? 'role_request_approve' : 'role_request_reject',
          targetType: 'role_request',
          details: JSON.stringify(input),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        return { success: true };
      }),
  }),

  // ============ 实验室管理 ============
  labRoom: router({
    list: publicProcedure.query(async () => {
      return await db.getAllLabRooms();
    }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getLabRoomById(input.id);
      }),
    
    create: labManageProcedure
      .input(z.object({
        roomNo: z.string(),
        name: z.string(),
        building: z.string().optional(),
        location: z.string().optional(),
        capacity: z.number().optional(),
        type: z.string().optional(),
        managerId: z.number().optional(),
        openTimeStart: z.string().optional(),
        openTimeEnd: z.string().optional(),
        status: z.enum(["enabled", "disabled"]).optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createLabRoom(input);
        return { success: true };
      }),
    
    update: labManageProcedure
      .input(z.object({
        id: z.number(),
        roomNo: z.string().optional(),
        name: z.string().optional(),
        building: z.string().optional(),
        location: z.string().optional(),
        capacity: z.number().optional(),
        type: z.string().optional(),
        managerId: z.number().optional(),
        openTimeStart: z.string().optional(),
        openTimeEnd: z.string().optional(),
        status: z.enum(["enabled", "disabled"]).optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateLabRoom(id, data);
        return { success: true };
      }),
    
    delete: labManageProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLabRoom(input.id);
        return { success: true };
      }),

    // [3L] 智能推荐（暂时注释）
    // recommend: protectedProcedure
    //   .input(z.object({
    //     peopleCount: z.number().min(1).optional(),
    //   }).optional())
    //   .query(async ({ ctx, input }) => {
    //     return await db.getLabRecommendations(ctx.user.id, input?.peopleCount);
    //   }),
  }),

  // ============ 预约管理 ============
  reservation: router({
    // 学生查看个人预约
    myList: protectedProcedure.query(async ({ ctx }) => {
      const reservations = await db.getUserReservations(ctx.user.id);
      // 关联实验室信息
      const roomIds = Array.from(new Set(reservations.map(r => r.labId)));
      const rooms = await Promise.all(roomIds.map(id => db.getLabRoomById(id)));
      const roomMap = new Map(rooms.filter(r => r).map(r => [r!.id, r!]));
      
      return reservations.map(r => ({
        ...r,
        labRoom: roomMap.get(r.labId),
      }));
    }),
    
    // 管理员查看所有预约（支持分页、搜索与分类）
    allList: reservationApproveProcedure
      .input(z.object({
        page: z.number().min(1).optional(),
        pageSize: z.number().min(1).max(100).optional(),
        q: z.string().optional(),
        status: z.string().optional(),
        labId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const opts = input || {};
        const page = opts.page || 1;
        const pageSize = opts.pageSize || 10;
        const q = opts.q;
        const status = opts.status;
        const labId = opts.labId;

        const { items, total } = await db.getReservationsPaged({ page, pageSize, q, status, labId });

        // 关联实验室信息
        const roomIds = Array.from(new Set(items.map(r => r.labId)));
        const rooms = await Promise.all(roomIds.map(id => db.getLabRoomById(id)));
        const roomMap = new Map(rooms.filter(r => r).map(r => [r!.id, r!]));

        const mapped = items.map(r => ({
          ...r,
          labRoom: roomMap.get(r.labId),
        }));

        return { items: mapped, total, page, pageSize };
      }),
    
    // 提交预约申请
    create: protectedProcedure
      .input(z.object({
        labId: z.number(),
        title: z.string(),
        reason: z.string().optional(),
        peopleCount: z.number().optional(),
        startTime: z.date(),
        endTime: z.date(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 0. 检查用户是否被黑名单
        const isBlacklisted = await db.isUserBlacklisted(ctx.user.id);
        if (isBlacklisted) {
          await db.createAuditLog({
            operatorUserId: ctx.user.id,
            operationType: 'reservation_create',
            targetType: 'reservation',
            details: JSON.stringify(input),
            reason: '用户在黑名单中，无法创建预约',
            result: 'failed',
            ipAddress: getClientIp(ctx.req),
          });
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '您因违约已被限制预约，请联系管理员'
          });
        }

        // 1. 检查实验室是否存在
        const lab = await db.getLabRoomById(input.labId);
        if (!lab) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '实验室不存在' });
        }
        if (lab.status !== 'enabled') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该实验室已停用' });
        }
        
        // 2. 检查时间合法性（标准化为 Date 对象后比较）
        const startTime = new Date(input.startTime);
        const endTime = new Date(input.endTime);
        
        if (startTime >= endTime) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '结束时间必须晚于开始时间' });
        }
        
        // 3. 检查时间冲突（个人预约）
        const hasConflict = await db.checkTimeConflict(input.labId, input.startTime, input.endTime);
        if (hasConflict) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该时间段已被预约' });
        }
        
        // 3.1 检查是否与课程排课冲突
        const scheduleConflict = await db.checkReservationConflictWithSchedule(
          input.labId,
          startTime,
          endTime
        );
        if (scheduleConflict.hasConflict) {
          const conflictInfo = scheduleConflict.conflicts.map(c => 
            `${c.courseName}（第${c.startPeriod}-${c.endPeriod}节，${c.timeRange}）`
          ).join('、');
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `该时间段与课程冲突：${conflictInfo}` 
          });
        }
        
        // 4. 执行完整的预约规则检查（MAX_PER_DAY、MAX_DURATION、ADVANCE_DAYS 等）
        const ruleCheckResult = await db.checkReservationRules(
          ctx.user.id,
          input.labId,
          input.startTime,
          input.endTime
        );
        
        if (!ruleCheckResult.valid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: ruleCheckResult.reason || '违反预约规则，请检查后重试'
          });
        }
        
        // 5. 创建预约
        await db.createReservation({
          ...input,
          userId: ctx.user.id,
          status: 'pending',
        });

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'reservation_create',
          targetType: 'reservation',
          details: JSON.stringify(input),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        return { success: true };
      }),
    
    // 取消预约
    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const reservation = await db.getReservationById(input.id);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
        }
        if (reservation.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此预约' });
        }
        if (reservation.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只能取消待审核的预约' });
        }
        
        await db.updateReservation(input.id, { status: 'cancelled' });
        return { success: true };
      }),

    // 签到
    checkin: protectedProcedure
      .input(z.object({
        id: z.number(),
        method: z.enum(["qrcode", "geofence", "manual"]),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        deviceInfo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const reservation = await db.getReservationById(input.id);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
        }
        const isAdmin = ['labAdmin', 'sysAdmin'].includes(ctx.user.role);
        if (!isAdmin && reservation.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此预约' });
        }
        const result = await db.checkinReservation(input.id, {
          method: input.method,
          latitude: input.latitude,
          longitude: input.longitude,
          deviceInfo: input.deviceInfo,
        });
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.reason });
        }
        
        // 记录详细的签到信息到审批日志
        const checkinDetails: Record<string, unknown> = {
          method: input.method,
          methodLabel: {
            qrcode: '扫码签到',
            geofence: '位置签到',
            manual: '手动签到'
          }[input.method],
          hasLocation: !!(input.latitude && input.longitude),
          locationVerified: input.method === 'geofence',
        };
        if (input.latitude && input.longitude) {
          checkinDetails.latitude = input.latitude;
          checkinDetails.longitude = input.longitude;
        }
        if (input.deviceInfo) {
          checkinDetails.deviceInfo = input.deviceInfo;
        }
        
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'reservation_checkin',
          targetType: 'reservation',
          targetId: input.id,
          details: JSON.stringify(checkinDetails),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),

    // 签退
    checkout: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const reservation = await db.getReservationById(input.id);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
        }
        const isAdmin = ['labAdmin', 'sysAdmin'].includes(ctx.user.role);
        if (!isAdmin && reservation.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此预约' });
        }
        const result = await db.checkoutReservation(input.id);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.reason });
        }
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'reservation_checkout',
          targetType: 'reservation',
          targetId: input.id,
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),
    
    // 审核通过
    approve: reservationApproveProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const reservation = await db.getReservationById(input.id);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
        }
        if (reservation.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只能审核待审核的预约' });
        }
        
        // 再次检查时间冲突
        const hasConflict = await db.checkTimeConflict(
          reservation.labId, 
          reservation.startTime, 
          reservation.endTime,
          reservation.id
        );
        if (hasConflict) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该时间段已被其他预约占用' });
        }
        
        await db.updateReservation(input.id, { 
          status: 'approved',
          approveTime: new Date(),
        });
        
        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'reservation_approve',
          targetType: 'reservation',
          targetId: input.id,
          details: JSON.stringify({ reservationId: input.id, newStatus: 'approved' }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        // 创建通知
        const lab = await db.getLabRoomById(reservation.labId);
        await db.createNotification({
          userId: reservation.userId,
          type: 'reservation_approved',
          title: '预约已通过',
          content: `您的实验室预约"${reservation.title}"（${lab?.name || '实验室'}）已通过审核。`,
          relatedId: reservation.id,
          relatedType: 'reservation',
        });
        
        return { success: true };
      }),
    
    // 审核拒绝
    reject: reservationApproveProcedure
      .input(z.object({ 
        id: z.number(),
        rejectReason: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const reservation = await db.getReservationById(input.id);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
        }
        if (reservation.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只能审核待审核的预约' });
        }
        
        await db.updateReservation(input.id, { 
          status: 'rejected',
          rejectReason: input.rejectReason,
          approveTime: new Date(),
        });
        
        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'reservation_reject',
          targetType: 'reservation',
          targetId: input.id,
          details: JSON.stringify({ reservationId: input.id, newStatus: 'rejected' }),
          reason: input.rejectReason,
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        // 创建通知
        const lab = await db.getLabRoomById(reservation.labId);
        await db.createNotification({
          userId: reservation.userId,
          type: 'reservation_rejected',
          title: '预约已拒绝',
          content: `您的实验室预约"${reservation.title}"（${lab?.name || '实验室'}）已被拒绝。原因：${input.rejectReason}`,
          relatedId: reservation.id,
          relatedType: 'reservation',
        });
        
        return { success: true };
      }),

    // 更新/重新安排预约
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        labId: z.number().optional(),
        title: z.string().optional(),
        reason: z.string().optional(),
        peopleCount: z.number().optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        bypassAdvanceRule: z.boolean().optional(), // 管理员可以绕过提前预约规则
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, bypassAdvanceRule, ...inputData } = input;
        
        // 获取原预约
        const reservation = await db.getReservationById(id);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
        }
        
        // 权限检查：只有预约者本人或管理员可以修改
        const isAdmin = ['labAdmin', 'sysAdmin'].includes(ctx.user.role);
        if (reservation.userId !== ctx.user.id && !isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此预约' });
        }
        
        // 检查是否可以修改（仅 pending 和 approved 状态可修改）
        if (!['pending', 'approved'].includes(reservation.status)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '当前状态不允许修改预约' });
        }
        
        // 如果修改了时间或实验室，需要额外检查
        const isTimeChanged = inputData.startTime || inputData.endTime || inputData.labId;
        
        // 准备更新数据
        const updateData: Partial<InsertLabReservation> = { ...inputData };
        
        if (isTimeChanged) {
          const newStartTime = inputData.startTime || reservation.startTime;
          const newEndTime = inputData.endTime || reservation.endTime;
          const newLabId = inputData.labId || reservation.labId;
          
          // 检查时间合法性
          if (new Date(newStartTime) >= new Date(newEndTime)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '结束时间必须晚于开始时间' });
          }
          
          // 检查时间冲突
          const hasConflict = await db.checkTimeConflict(
            newLabId,
            newStartTime,
            newEndTime,
            id // 排除当前预约
          );
          
          if (hasConflict) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '该时间段已被预约' });
          }
          
          // 检查预约规则（管理员且明确绕过时跳过 ADVANCE_DAYS 规则）
          if (isAdmin && bypassAdvanceRule) {
            // 管理员绕过提前预约规则，但仍需检查其他规则
            const ruleCheckResult = await db.checkReservationRulesExceptAdvance(
              ctx.user.id,
              newLabId,
              newStartTime,
              newEndTime
            );
            
            if (!ruleCheckResult.valid) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: ruleCheckResult.reason || '违反预约规则'
              });
            }
          } else {
            // 普通用户或管理员未绕过，检查所有规则
            const ruleCheckResult = await db.checkReservationRules(
              ctx.user.id,
              newLabId,
              newStartTime,
              newEndTime
            );
            
            if (!ruleCheckResult.valid) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: ruleCheckResult.reason || '违反预约规则'
              });
            }
          }
          
          // 如果修改了时间/实验室，将状态改为 pending 重新审核
          // 即使原本就是 pending，也要确保更新 updatedAt
          if (reservation.status === 'approved') {
            updateData.status = 'pending';
          }
          // 对于原本就是 pending 的，不改变状态，但 updatedAt 会自动更新
        }
        
        // 执行更新
        await db.updateReservation(id, updateData);
        
        // 验证更新后的记录
        const updated = await db.getReservationById(id);
        if (updated) {
          console.log('[Update] Reservation updated:', {
            id: updated.id,
            status: updated.status,
            startTime: updated.startTime,
            endTime: updated.endTime,
            updatedAt: updated.updatedAt,
          });
        }
        
        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'reservation_update',
          targetType: 'reservation',
          targetId: id,
          details: JSON.stringify({ 
            reservationId: id, 
            updates: updateData,
            isTimeChanged,
            bypassAdvanceRule: isAdmin && bypassAdvanceRule 
          }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        return { success: true, needsReApproval: isTimeChanged };
      }),

    // 获取冲突详情
    getConflictDetails: protectedProcedure
      .input(z.object({
        reservationId: z.number(),
      }))
      .query(async ({ input }) => {
        const reservation = await db.getReservationById(input.reservationId);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
        }
        
        // 查找与此预约冲突的其他预约
        const conflictingReservations = await db.getConflictingReservations(
          reservation.labId,
          reservation.startTime,
          reservation.endTime,
          reservation.id
        );
        
        // 获取冲突预约的详细信息
        const conflicts = await Promise.all(
          conflictingReservations.map(async (r) => {
            const lab = await db.getLabRoomById(r.labId);
            const user = await db.getUserById(r.userId);
            return {
              id: r.id,
              title: r.title,
              startTime: r.startTime,
              endTime: r.endTime,
              status: r.status,
              lab: lab ? { id: lab.id, name: lab.name } : null,
              applicant: user ? { id: user.id, name: user.name } : null,
            };
          })
        );
        
        return conflicts;
      }),
  }),

  // ============ 预约规则管理 ============
  rule: router({
    list: ruleManageProcedure.query(async () => {
      return await db.getAllRules();
    }),
    
    // 获取启用的规则（用于前端显示提示）
    listEnabled: publicProcedure.query(async () => {
      return await db.getEnabledRules();
    }),
    
    // 预检查：检查用户的预约是否符合规则
    preCheck: protectedProcedure
      .input(z.object({
        labId: z.number(),
        startTime: z.date(),
        endTime: z.date(),
      }))
      .query(async ({ ctx, input }) => {
        const result = await db.checkReservationRules(
          ctx.user.id,
          input.labId,
          input.startTime,
          input.endTime
        );
        return result;
      }),

    // 获取冲突预约详情（用于前端显示冲突列表）
    getConflictingReservations: protectedProcedure
      .input(z.object({
        labId: z.number(),
        startTime: z.date(),
        endTime: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getConflictingReservationDetails(
          input.labId,
          input.startTime,
          input.endTime
        );
      }),
    
    update: ruleManageProcedure
      .input(z.object({
        id: z.number(),
        ruleValue: z.string(),
        status: z.enum(["enabled", "disabled"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateRule(id, data);
        return { success: true };
      }),
  }),

  // ============ 设备管理 ============
  device: router({
    list: publicProcedure.query(async () => {
      return await db.getAllDevices();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getDeviceById(input.id);
      }),

    listByLab: publicProcedure
      .input(z.object({ labId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDevicesByLabId(input.labId);
      }),

    create: deviceManageProcedure
      .input(z.object({
        labId: z.number(),
        deviceNo: z.string(),
        name: z.string(),
        type: z.string().optional(),
        purchaseDate: z.date().optional(),
        status: z.enum(["available", "maintenance", "retired"]).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createDevice(input);
        return { success: true };
      }),

    update: labAdminProcedure
      .input(z.object({
        id: z.number(),
        labId: z.number().optional(),
        deviceNo: z.string().optional(),
        name: z.string().optional(),
        type: z.string().optional(),
        purchaseDate: z.date().optional(),
        status: z.enum(["available", "maintenance", "retired"]).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateDevice(id, data);
        return { success: true };
      }),

    delete: deviceManageProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDevice(input.id);
        return { success: true };
      }),
  }),

  // ============ 统计分析 ============
  statistics: router({
    summary: statisticsViewProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getStatisticsSummary(input.startDate, input.endDate);
      }),

    labUsage: statisticsViewProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getLabUsageStatistics(input.startDate, input.endDate);
      }),

    userActivity: statisticsViewProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return await db.getUserActivityRanking(input.limit, input.startDate, input.endDate);
      }),

    timeDistribution: statisticsViewProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getReservationTimeDistribution(input.startDate, input.endDate);
      }),

    statusStatistics: statisticsViewProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getReservationStatusStatistics(input.startDate, input.endDate);
      }),
  }),

  // ============ 通知管理 ============
  notification: router({
    // 获取用户通知列表
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50).optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getUserNotifications(ctx.user.id, input.limit);
      }),
    
    // 获取未读通知数量
    getUnreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUnreadNotificationCount(ctx.user.id);
      }),
    
    // 标记单个通知为已读
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markNotificationAsRead(input.id, ctx.user.id);
        return { success: true };
      }),
    
    // 标记所有通知为已读
    markAllRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.markAllNotificationsAsRead(ctx.user.id);
        return { success: true };
      }),
    
    // 删除通知
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteNotification(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ============ 审批与违规则管理 ============
  approval: router({
    // 获取某个实验室的审批配置
    getConfigForLab: publicProcedure
      .input(z.object({ labId: z.number() }))
      .query(async ({ input }) => {
        return await db.getApprovalConfigForLab(input.labId);
      }),

    // 获取所有审批配置（管理员）
    getAllConfigs: labAdminProcedure
      .query(async () => {
        return await db.getAllApprovalConfigs();
      }),

    // 管理员创建或更新审批配置
    updateConfig: labAdminProcedure
      .input(z.object({
        id: z.number().optional(),
        labId: z.number().nullable(),
        name: z.string(),
        enableMultiLevel: z.number(),
        approvalStages: z.string(), // JSON string
        rescheduleWindowHours: z.number().optional(),
        maxRescheduleCount: z.number().optional(),
        autoCancelHours: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // 转换 autoCancelHours 为字符串用于数据库存储
          const configData = {
            ...input,
            autoCancelHours: input.autoCancelHours !== undefined ? String(input.autoCancelHours) : undefined,
          };

          if (input.id) {
            await db.updateApprovalConfig(input.id, {
              ...configData,
              id: undefined,
            });
          } else {
            await db.createApprovalConfig({
              ...configData,
              status: 'enabled',
            });
          }

          // 记录审计日志
          await db.createAuditLog({
            operatorUserId: ctx.user.id,
            operationType: 'approval_config_update',
            targetType: 'approval_config',
            targetId: input.id,
            details: JSON.stringify(input),
            result: 'success',
          });

          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '审批配置更新失败',
          });
        }
      }),

    // 获取某个预约的审批历史
    getHistories: protectedProcedure
      .input(z.object({ reservationId: z.number() }))
      .query(async ({ input }) => {
        return await db.getApprovalHistoriesForReservation(input.reservationId);
      }),

    // 管理员手动触发自动取消超时预约
    triggerAutoCancelOverdue: labAdminProcedure
      .mutation(async ({ ctx }) => {
        try {
          const result = await db.autoCancelOverdueReservations();
          
          // 记录审计日志
          await db.createAuditLog({
            operatorUserId: ctx.user.id,
            operationType: 'auto_cancel_overdue',
            targetType: 'reservation',
            targetId: null,
            details: JSON.stringify({ cancelledCount: result.cancelledCount }),
            result: 'success',
          });

          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '自动取消操作失败',
          });
        }
      }),

    // 管理员手动触发超时未签退检测
    triggerTimeoutDetection: labAdminProcedure
      .mutation(async ({ ctx }) => {
        try {
          const result = await db.autoDetectTimeoutCheckout();
          
          // 记录审计日志
          await db.createAuditLog({
            operatorUserId: ctx.user.id,
            operationType: 'auto_cancel_overdue',
            targetType: 'reservation',
            targetId: null,
            details: JSON.stringify({ violationCount: result.violationCount, type: 'timeout_detection' }),
            result: 'success',
          });

          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '超时检测操作失败',
          });
        }
      }),
  }),

  // ============ 违约与黑名单管理 ============
  violation: router({
    // 获取用户的违约记录
    getRecords: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserViolations(ctx.user.id);
      }),

    // 管理员获取所有用户的违约记录
    getAllRecords: violationManageProcedure
      .query(async () => {
        return await db.getAllViolations();
      }),

    // 获取用户总违约分
    getTotalPoints: protectedProcedure
      .query(async ({ ctx }) => {
        const points = await db.getUserTotalViolationPoints(ctx.user.id);
        return { totalPoints: points };
      }),

    // 管理员记录违约
    recordViolation: violationManageProcedure
      .input(z.object({
        userId: z.number(),
        reservationId: z.number().optional(),
        violationType: z.enum(['no_show', 'late_cancel', 'timeout_checkout', 'manual_record']),
        points: z.number().default(1),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          await db.recordViolation({
            userId: input.userId,
            reservationId: input.reservationId,
            violationType: input.violationType,
            points: input.points,
            description: input.description,
          });

          // 记录审计日志
          await db.createAuditLog({
            operatorUserId: ctx.user.id,
            operationType: 'violation_record',
            targetType: 'user',
            targetId: input.userId,
            details: JSON.stringify(input),
            reason: input.description,
            result: 'success',
            ipAddress: getClientIp(ctx.req),
          });

          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '违约记录失败',
          });
        }
      }),

    // 检查用户是否在黑名单
    isBlacklisted: protectedProcedure
      .query(async ({ ctx }) => {
        const isBlacklisted = await db.isUserBlacklisted(ctx.user.id);
        const record = isBlacklisted ? await db.getUserBlacklist(ctx.user.id) : null;
        return { isBlacklisted, record };
      }),

    // 获取用户黑名单记录
    getBlacklist: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserBlacklist(ctx.user.id);
      }),

    // 管理员移除黑名单
    removeBlacklist: violationManageProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await db.removeFromBlacklist(input.userId);

          // 记录审计日志
          await db.createAuditLog({
            operatorUserId: ctx.user.id,
            operationType: 'blacklist_remove',
            targetType: 'user',
            targetId: input.userId,
            result: 'success',
            ipAddress: getClientIp(ctx.req),
          });

          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '移除黑名单失败',
          });
        }
      }),

    // 管理员获取所有黑名单用户
    getAllBlacklist: violationManageProcedure
      .query(async () => {
        return await db.getAllBlacklistUsers();
      }),
  }),

  // ============ 审计日志 ============
  audit: router({
    // 查询审计日志
    getLogs: auditViewProcedure
      .input(z.object({
        operationType: z.string().optional(),
        targetType: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return await db.getAuditLogs({
          operationType: input.operationType,
          targetType: input.targetType,
          startDate: input.startDate,
          endDate: input.endDate,
          limit: input.limit,
          offset: input.offset,
        });
      }),

    // 查询某个预约相关的审计日志
    getByReservation: protectedProcedure
      .input(z.object({ reservationId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAuditLogsByReservation(input.reservationId);
      }),
  }),

  // ============ AI 智能功能 ============
  ai: router({
    // AI 润色预约理由
    generateReason: protectedProcedure
      .input(z.object({
        userInput: z.string(),
        labName: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 频率限制：每个用户每分钟最多 5 次请求
        const rateLimitKey = `generateReason:${ctx.user.id}`;
        if (!checkRateLimit(rateLimitKey, 5, 60 * 1000)) {
          throw new TRPCError({ 
            code: 'TOO_MANY_REQUESTS', 
            message: 'AI 润色请求过于频繁，请稍后再试（限制：每分钟5次）'
          });
        }

        try {
          const result = await xfspark.generateReason(input.userInput, input.labName);
          return { text: result };
        } catch (error) {
          const message = error instanceof Error ? error.message : '生成失败';
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
        }
      }),
    
    // AI 生成管理洞察报告
    generateInsight: adminProcedure
      .input(z.object({
        totalReservations: z.number(),
        pendingCount: z.number(),
        approvedCount: z.number(),
        rejectedCount: z.number(),
        topLabs: z.array(z.object({ name: z.string(), count: z.number() })),
        weeklyTrend: z.array(z.object({ date: z.string(), count: z.number() })),
      }))
      .mutation(async ({ input, ctx }) => {
        // 频率限制：每个管理员每小时最多 20 次请求
        const rateLimitKey = `generateInsight:${ctx.user.id}`;
        if (!checkRateLimit(rateLimitKey, 20, 60 * 60 * 1000)) {
          throw new TRPCError({ 
            code: 'TOO_MANY_REQUESTS', 
            message: 'AI 报告生成请求过于频繁，请稍后再试（限制：每小时20次）'
          });
        }

        try {
          const result = await xfspark.generateInsight(input);
          return { text: result };
        } catch (error) {
          const message = error instanceof Error ? error.message : '生成失败';
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
        }
      }),
  }),

  // ============ 课程管理（Phase 4 P1）============
  course: router({
    // 获取课程列表（根据用户角色返回不同数据）
    list: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role === 'teacher') {
          return await db.getCoursesByTeacherId(ctx.user.id);
        } else if (ctx.user.role === 'student') {
          return await db.getStudentCourses(ctx.user.id);
        } else {
          return await db.getAllCourses();
        }
      }),

    // 教师创建课程
    create: teacherProcedure
      .input(z.object({
        courseNo: z.string().min(1),
        name: z.string().min(1),
        description: z.string()
          .transform(val => val && val.trim() ? val.trim() : null)
          .nullable(),
        semester: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // 先检查课程号是否已存在
          const courseNoExists = await db.checkCourseNoExists(input.courseNo.trim());
          if (courseNoExists) {
            throw new TRPCError({ 
              code: 'CONFLICT', 
              message: `课程号 "${input.courseNo.trim()}" 已存在，请使用不同的课程号` 
            });
          }

          await db.createCourse({
            courseNo: input.courseNo.trim(),
            name: input.name.trim(),
            description: input.description,
            teacherId: ctx.user.id,
            semester: input.semester.trim(),
            status: 'active',
          } as any);
          
          // 记录审计日志
          await db.createAuditLog({
            operatorUserId: ctx.user.id,
            operationType: 'course_create',
            targetType: 'course',
            details: JSON.stringify(input),
            result: 'success',
            ipAddress: getClientIp(ctx.req),
          });
          
          return { success: true };
        } catch (error: any) {
          // 如果是已知的 TRPCError，直接抛出
          if (error instanceof TRPCError) {
            throw error;
          }
          // 处理课程号重复（备用）
          if (error.code === 'DUPLICATE_COURSE_NO' || error.message?.includes('课程号已存在')) {
            throw new TRPCError({ 
              code: 'CONFLICT', 
              message: `课程号 "${input.courseNo.trim()}" 已存在，请使用不同的课程号` 
            });
          }
          // 其他数据库错误
          console.error('Course creation error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || '创建课程失败'
          });
        }
      }),

    // 教师查看自己的课程
    myList: teacherProcedure
      .query(async ({ ctx }) => {
        return await db.getCoursesByTeacherId(ctx.user.id);
      }),

    // 管理员查看所有课程
    allList: adminProcedure
      .query(async () => {
        return await db.getAllCourses();
      }),

    // 学生查看自己参与的课程
    enrolledCourses: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'student') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有学生可以查看已选课程' });
        }
        return await db.getStudentCourses(ctx.user.id);
      }),

    // 教师添加学生到课程
    addStudent: teacherProcedure
      .input(z.object({
        courseId: z.number(),
        studentOpenIds: z.array(z.string()).optional(), // 学生OpenId列表
        classId: z.number().optional(), // 班级ID（批量添加该班所有学生）
      }))
      .mutation(async ({ ctx, input }) => {
        // 验证课程所有权
        const course = await db.getCourseById(input.courseId);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此课程' });
        }

        let studentsToAdd: { id: number; name?: string }[] = [];

        // 方式1：按 openId 添加
        if (input.studentOpenIds && input.studentOpenIds.length > 0) {
          for (const openId of input.studentOpenIds) {
            const student = await db.getUserByOpenId(openId);
            if (student) {
              studentsToAdd.push({ id: student.id, name: student.name || undefined });
            }
          }
        }

        // 方式2：按班级添加
        if (input.classId) {
          const classStudents = await db.getClassStudents(input.classId);
          for (const cs of classStudents) {
            studentsToAdd.push({ id: cs.studentId, name: cs.studentName || undefined });
          }
        }

        // 添加学生到课程
        const addedCount = new Set<number>();
        for (const student of studentsToAdd) {
          if (!addedCount.has(student.id)) {
            try {
              await db.addStudentToCourse(input.courseId, student.id);
              addedCount.add(student.id);
            } catch (error) {
              // 如果学生已存在，忽略错误
              console.log(`学生 ${student.name} (ID: ${student.id}) 已在课程中`);
            }
          }
        }

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'course_student_add',
          targetType: 'course',
          targetId: input.courseId,
          details: JSON.stringify({ 
            studentCount: addedCount.size,
            byOpenIds: input.studentOpenIds?.length || 0,
            byClassId: input.classId || null
          }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { 
          success: true, 
          addedCount: addedCount.size,
          totalAttempted: studentsToAdd.length 
        };
      }),

    // 获取课程学生列表
    getStudents: teacherProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const course = await db.getCourseById(input.courseId);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权查看此课程' });
        }
        return await db.getCourseStudents(input.courseId);
      }),

    // 教师从课程中移除学生
    removeStudent: teacherProcedure
      .input(z.object({
        courseId: z.number(),
        studentId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const course = await db.getCourseById(input.courseId);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此课程' });
        }

        await db.removeStudentFromCourse(input.courseId, input.studentId);

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'course_student_remove',
          targetType: 'course',
          targetId: input.courseId,
          details: JSON.stringify({ studentId: input.studentId }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),

    // 教师更新课程信息
    update: teacherProcedure
      .input(z.object({
        id: z.number(),
        courseNo: z.string().optional(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        semester: z.string().optional(),
        status: z.enum(['active', 'archived']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const course = await db.getCourseById(input.id);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此课程' });
        }

        const { id, ...data } = input;
        await db.updateCourse(id, data);

        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'course_update',
          targetType: 'course',
          targetId: id,
          details: JSON.stringify(data),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),

    // 教师删除课程
    delete: teacherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const course = await db.getCourseById(input.id);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此课程' });
        }

        // 检查是否有进行中的排课或预约
        const schedules = await db.getCourseSchedules(input.id);
        const pendingSchedules = schedules.filter((s: any) => s.status === 'pending' || s.status === 'approved');
        if (pendingSchedules.length > 0) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: '该课程还有进行中的排课，请先取消或完成后再删除' 
          });
        }

        await db.deleteCourse(input.id);

        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'course_delete',
          targetType: 'course',
          targetId: input.id,
          details: JSON.stringify({ courseName: course.name }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),
  }),

  // ============ 课程预约管理 ============
  courseReservation: router({
    // 教师创建课程预约
    create: teacherProcedure
      .input(z.object({
        courseId: z.number(),
        labId: z.number(),
        title: z.string(),
        reason: z.string().optional(),
        startTime: z.date(),
        endTime: z.date(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 验证课程所有权
        const course = await db.getCourseById(input.courseId);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此课程' });
        }

        // 检查时间冲突（个人预约）
        const hasConflict = await db.checkTimeConflict(input.labId, input.startTime, input.endTime);
        if (hasConflict) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该时间段已被预约' });
        }

        // 检查与课程排课的冲突
        const scheduleConflict = await db.checkReservationConflictWithSchedule(
          input.labId,
          input.startTime,
          input.endTime
        );
        if (scheduleConflict.hasConflict) {
          const conflictInfo = scheduleConflict.conflicts.map(c => 
            `${c.courseName}（第${c.startPeriod}-${c.endPeriod}节，${c.timeRange}）`
          ).join('、');
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `该时间段与课程冲突：${conflictInfo}` 
          });
        }

        await db.createCourseReservation({
          ...input,
          status: 'pending',
        });

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'course_reservation_create',
          targetType: 'course_reservation',
          details: JSON.stringify(input),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),

    // 获取课程的所有预约（学生视角：只显示有效预约）
    getByCourse: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCourseReservationsByCourse(input.courseId);
      }),

    // 获取课程的所有预约（教师视角：包括已取消的）
    getAllByCourse: teacherProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAllCourseReservationsByCourse(input.courseId);
      }),

    // 获取所有可用的实验室
    listLabs: teacherProcedure
      .query(async () => {
        return await db.getAllLabRooms();
      }),

    // 检查实验室在指定时间的预约情况
    checkLabAvailability: teacherProcedure
      .input(z.object({
        labId: z.number(),
        startTime: z.date(),
        endTime: z.date(),
      }))
      .query(async ({ input }) => {
        const hasConflict = await db.checkTimeConflict(input.labId, input.startTime, input.endTime);
        return { available: !hasConflict };
      }),

    // 教师更新课程预约
    update: teacherProcedure
      .input(z.object({
        reservationId: z.number(),
        labId: z.number().optional(),
        title: z.string().optional(),
        reason: z.string().nullable().optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const reservation = await db.getCourseReservationById(input.reservationId);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
        }
        const course = await db.getCourseById(reservation.courseId);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权修改此预约' });
        }
        if (reservation.status === 'cancelled' || reservation.status === 'completed') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '已取消或已完成的预约无法修改' });
        }

        const { reservationId, ...data } = input;
        const labId = data.labId ?? reservation.labId;
        const startTime = data.startTime ?? new Date(reservation.startTime);
        const endTime = data.endTime ?? new Date(reservation.endTime);

        if (data.labId || data.startTime || data.endTime) {
          const hasConflict = await db.checkTimeConflict(labId, startTime, endTime, reservationId);
          if (hasConflict) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '该时间段已被预约' });
          }
        }

        await db.updateCourseReservation(reservationId, { ...data, status: 'pending' });

        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'course_reservation_update',
          targetType: 'course_reservation',
          targetId: reservationId,
          details: JSON.stringify(data),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),

    // 教师取消课程预约
    cancel: teacherProcedure
      .input(z.object({
        reservationId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 获取预约信息
        const reservation = await db.getCourseReservationById(input.reservationId);
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '预约不存在' });
        }

        // 验证课程所有权
        const course = await db.getCourseById(reservation.courseId);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权取消此预约' });
        }

        // 只能取消未审批或已批准的预约
        if (reservation.status === 'cancelled' || reservation.status === 'completed') {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `无法取消${reservation.status === 'cancelled' ? '已取消' : '已完成'}的预约` 
          });
        }

        // 更新为已取消
        await db.updateCourseReservation(input.reservationId, {
          status: 'cancelled',
        });

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'course_reservation_cancel',
          targetType: 'course_reservation',
          targetId: input.reservationId,
          details: JSON.stringify({ reservationId: input.reservationId }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),

    // ============ 课程预约审批（管理员） ============

    // 获取待审批的课程预约
    getPendingReservations: adminProcedure
      .input(z.object({
        labId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getPendingCourseReservations(input?.labId);
      }),

    // 审批通过课程预约
    approve: adminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.approveCourseReservation(input.id);
        
        // 获取预约信息发送通知
        const reservation = await db.getCourseReservationById(input.id);
        if (reservation) {
          const course = await db.getCourseById(reservation.courseId);
          if (course) {
            await db.createNotification({
              userId: course.teacherId,
              type: 'reservation_approved',
              title: '课程预约已通过',
              content: `您的课程「${course.name}」临时预约「${reservation.title}」已通过审批`,
              relatedType: 'course_reservation',
              relatedId: input.id,
            });
          }
        }

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'course_reservation_approve',
          targetType: 'course_reservation',
          targetId: input.id,
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        return { success: true };
      }),

    // 拒绝课程预约
    reject: adminProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.rejectCourseReservation(input.id, input.reason);
        
        // 获取预约信息发送通知
        const reservation = await db.getCourseReservationById(input.id);
        if (reservation) {
          const course = await db.getCourseById(reservation.courseId);
          if (course) {
            await db.createNotification({
              userId: course.teacherId,
              type: 'reservation_rejected',
              title: '课程预约被拒绝',
              content: `您的课程「${course.name}」临时预约「${reservation.title}」被拒绝${input.reason ? `，原因：${input.reason}` : ''}`,
              relatedType: 'course_reservation',
              relatedId: input.id,
            });
          }
        }

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'course_reservation_reject',
          targetType: 'course_reservation',
          targetId: input.id,
          details: JSON.stringify({ reason: input.reason }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        
        return { success: true };
      }),
  }),

  // ============ 开放规则管理（Phase 4 P1）============
  openingRule: router({
    // 获取实验室开放规则
    getForLab: publicProcedure
      .input(z.object({ labId: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getOpeningRulesForLab(input.labId);
      }),

    // 管理员创建或更新开放规则
    upsert: ruleManageProcedure
      .input(z.object({
        id: z.number().optional(),
        labId: z.number().nullable(),
        dayOfWeek: z.number(),
        openTime: z.string(),
        closeTime: z.string(),
        isWorkday: z.number(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { status, ...ruleData } = input;
        if (input.id) {
          await db.updateOpeningRule(input.id, {
            ...ruleData,
            ...(status && { status }),
          });
        } else {
          await db.createOpeningRule({
            ...ruleData,
            status: status || 'enabled',
          });
        }

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'opening_rule_update',
          targetType: 'opening_rule',
          targetId: input.id,
          details: JSON.stringify(input),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),
  }),

  // ============ 禁用时段管理（Phase 4 P1）============
  blockedPeriod: router({
    // 获取禁用时段列表
    list: ruleManageProcedure
      .input(z.object({
        labId: z.number().optional(),
        deviceId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getBlockedPeriods(input);
      }),

    // 创建禁用时段
    create: ruleManageProcedure
      .input(z.object({
        labId: z.number().nullable(),
        deviceId: z.number().nullable(),
        reason: z.string(),
        startDate: z.date(),
        endDate: z.date(),
        handleExisting: z.enum(['allow', 'warn', 'cancel']),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createBlockedPeriod({
          ...input,
          reason: normalizeReason(input.reason),
          status: 'active',
        });

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'blocked_period_create',
          targetType: 'blocked_period',
          details: JSON.stringify(input),
          reason: input.reason,
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),

    // 更新禁用时段
    update: ruleManageProcedure
      .input(z.object({
        id: z.number(),
        labId: z.number().nullable().optional(),
        deviceId: z.number().nullable().optional(),
        reason: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.enum(['active', 'inactive']).optional(),
        handleExisting: z.enum(['allow', 'warn', 'cancel']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updateData } = input;
        
        // 构建更新数据对象，只包含提供的字段
        const updateFields: any = {};
        if (updateData.status !== undefined) updateFields.status = updateData.status;
        if (updateData.handleExisting !== undefined) updateFields.handleExisting = updateData.handleExisting;
        if (updateData.labId !== undefined) updateFields.labId = updateData.labId;
        if (updateData.deviceId !== undefined) updateFields.deviceId = updateData.deviceId;
        if (updateData.reason !== undefined) updateFields.reason = normalizeReason(updateData.reason);
        if (updateData.startDate !== undefined) updateFields.startDate = updateData.startDate;
        if (updateData.endDate !== undefined) updateFields.endDate = updateData.endDate;

        await db.updateBlockedPeriod(id, updateFields);

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'blocked_period_update',
          targetType: 'blocked_period',
          targetId: id,
          details: JSON.stringify(input),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),
  }),

  // ============ 实验室地理围栏（签到支持）============
  geofence: router({
    list: geofenceManageProcedure
      .input(z.object({ labId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.listLabGeofences(input?.labId);
      }),

    create: geofenceManageProcedure
      .input(z.object({
        labId: z.number(),
        latitude: z.number(),
        longitude: z.number(),
        radius: z.number().min(10).max(2000).optional(),
        name: z.string().optional(),
        status: z.enum(["enabled", "disabled"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createLabGeofence({
          labId: input.labId,
          latitude: String(input.latitude),
          longitude: String(input.longitude),
          radius: input.radius ?? 100,
          name: input.name,
          status: input.status ?? "enabled",
        });
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'geofence_create',
          targetType: 'lab_geofence',
          details: JSON.stringify(input),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),

    update: geofenceManageProcedure
      .input(z.object({
        id: z.number(),
        labId: z.number().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        radius: z.number().min(10).max(2000).optional(),
        name: z.string().optional(),
        status: z.enum(["enabled", "disabled"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...rest } = input;
        const updateData: any = { ...rest };
        if (rest.latitude !== undefined) updateData.latitude = String(rest.latitude);
        if (rest.longitude !== undefined) updateData.longitude = String(rest.longitude);
        await db.updateLabGeofence(id, updateData);
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'geofence_update',
          targetType: 'lab_geofence',
          targetId: id,
          details: JSON.stringify(input),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),

    delete: geofenceManageProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteLabGeofence(input.id);
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'geofence_delete',
          targetType: 'lab_geofence',
          targetId: input.id,
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),
  }),

  // ============ 班级管理（Classes）============
  class: router({
    // 创建班级
    create: adminProcedure
      .input(z.object({
        classNo: z.string(),
        name: z.string(),
        major: z.string().optional(),
        grade: z.string().optional(),
        capacity: z.number().optional(),
        description: z.string().optional(),
        semester: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createClass({
          ...input,
          status: 'active',
        });

        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'class_create',
          targetType: 'class',
          details: JSON.stringify(input),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),

    // 获取所有班级
    list: protectedProcedure
      .query(async () => {
        return await db.getClassesByStatus('active');
      }),

    // 获取班级详情
    getById: protectedProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ input }) => {
        return await db.getClassById(input.classId);
      }),

    // 获取班级学生列表
    getStudents: protectedProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ input }) => {
        return await db.getClassStudents(input.classId);
      }),

    // 添加学生到班级
    addStudent: adminProcedure
      .input(z.object({
        classId: z.number(),
        studentOpenIds: z.array(z.string()),
      }))
      .mutation(async ({ ctx, input }) => {
        const addedCount = new Set<number>();

        for (const openId of input.studentOpenIds) {
          const student = await db.getUserByOpenId(openId);
          if (student && student.role === 'student') {
            try {
              await db.addStudentToClass(input.classId, student.id);
              addedCount.add(student.id);
            } catch (error) {
              console.log(`学生 ${student.name} (ID: ${student.id}) 已在班级中`);
            }
          }
        }

        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'class_student_add',
          targetType: 'class',
          targetId: input.classId,
          details: JSON.stringify({ studentCount: addedCount.size }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true, addedCount: addedCount.size };
      }),

    // 从班级移除学生
    removeStudent: adminProcedure
      .input(z.object({
        classId: z.number(),
        studentId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.removeStudentFromClass(input.classId, input.studentId);

        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'class_student_remove',
          targetType: 'class',
          targetId: input.classId,
          details: JSON.stringify({ studentId: input.studentId }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),
  }),

  // ============ 日历与调度 ============
  calendar: router({
    getReservationDetails: protectedProcedure
      .input(z.object({
        reservationId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getReservationDetails(input.reservationId);
      }),

    getReservationsByTimeRange: protectedProcedure
      .input(z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        labId: z.number().optional(),
        deviceId: z.number().optional(),
        courseId: z.number().optional(),
        teacherId: z.number().optional(),
        status: z.enum(['pending', 'approved', 'rejected', 'completed', 'cancelled', 'violated']).optional(),
      }))
      .query(async ({ input }) => {
        return await db.getReservationsByTimeRange(input);
      }),

    getLabCalendar: protectedProcedure
      .input(z.object({
        labId: z.number(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        viewType: z.enum(['day', 'week', 'month', 'heatmap']),
      }))
      .query(async ({ input }) => {
        return await db.getLabCalendarData(input);
      }),

    getDeviceCalendar: protectedProcedure
      .input(z.object({
        deviceId: z.number(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        viewType: z.enum(['day', 'week', 'month', 'heatmap']),
      }))
      .query(async ({ input }) => {
        // 获取设备信息及其所在的实验室
        const device = await db.getDeviceById(input.deviceId);
        if (!device) {
          return {
            events: [],
            blockedPeriods: [],
            summary: {
              totalReservations: 0,
              approved: 0,
              pending: 0,
            },
          };
        }

        // 获取该实验室的所有预约（设备筛选功能待后续完整支持，目前显示实验室预约）
        const reservations = await db.getReservationsByTimeRange({
          startDate: input.startDate,
          endDate: input.endDate,
          labId: device.labId,
        });
        
        return {
          events: reservations,
          blockedPeriods: [],
          summary: {
            totalReservations: reservations.length,
            approved: reservations.filter((r: any) => r.status === 'approved').length,
            pending: reservations.filter((r: any) => r.status === 'pending').length,
          },
        };
      }),

    getCourseCalendar: teacherProcedure
      .input(z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getCourseCalendarByTeacher(ctx.user.id, input.startDate, input.endDate);
      }),

    getAllCourseCalendar: protectedProcedure
      .input(z.object({
        courseId: z.number().optional(),
        teacherId: z.number().optional(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      }))
      .query(async ({ input }) => {
        const reservations = await db.getReservationsByTimeRange({
          startDate: input.startDate,
          endDate: input.endDate,
          courseId: input.courseId,
          teacherId: input.teacherId,
        });

        return {
          events: reservations.filter((r: any) => r.courseId !== null),
          summary: {
            totalReservations: reservations.length,
            approved: reservations.filter((r: any) => r.status === 'approved').length,
            pending: reservations.filter((r: any) => r.status === 'pending').length,
          },
        };
      }),

    // 获取月度资源利用率数据（用于热力图）
    getMonthlyUtilization: protectedProcedure
      .input(z.object({
        labId: z.number().optional(),
        deviceId: z.number().optional(),
        courseId: z.number().optional(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      }))
      .query(async ({ input }) => {
        return await db.getMonthlyUtilizationData(input);
      }),

    getConflictSuggestions: protectedProcedure
      .input(z.object({
        labId: z.number(),
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
        excludeReservationId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getAlternativeTimeSlots(input);
      }),

    // 获取所有有冲突的预约（管理员功能）
    getConflictingReservations: labAdminProcedure
      .input(z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        labId: z.number().optional(),
        status: z.enum(['pending', 'approved', 'rejected', 'completed', 'cancelled', 'violated']).optional(),
      }))
      .query(async ({ input }) => {
        const conflicts = await db.getAllConflictingReservations(input);
        
        // 获取额外的预约详情
        const enrichedConflicts = await Promise.all(
          conflicts.map(async (conflict: any) => {
            const lab = await db.getLabRoomById(conflict.labId);
            const user = await db.getUserById(conflict.userId);
            
            return {
              id: conflict.id,
              title: conflict.title,
              startTime: conflict.startTime,
              endTime: conflict.endTime,
              status: conflict.status,
              peopleCount: conflict.peopleCount,
              reason: conflict.reason,
              conflictCount: conflict.conflictCount,
              conflictIds: conflict.conflictIds,
              lab: lab ? { id: lab.id, name: lab.name, roomNo: lab.roomNo } : null,
              applicant: user ? { id: user.id, name: user.name, email: user.email } : null,
            };
          })
        );
        
        return enrichedConflicts;
      }),
  }),

  // ============ 课堂签到管理 ============
  classCheckin: router({
    // 获取节次时间表
    getPeriods: publicProcedure.query(async () => {
      return await db.getPeriodTimeMapping();
    }),

    // 创建节次时间
    createPeriod: sysAdminProcedure
      .input(z.object({
        periodNo: z.number().min(1).max(12),
        periodName: z.string().optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      }))
      .mutation(async ({ input }) => {
        // 验证时间格式和逻辑
        const [startHour, startMin] = input.startTime.split(':').map(Number);
        const [endHour, endMin] = input.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (startMinutes >= endMinutes) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '开始时间必须早于结束时间' });
        }

        const id = await db.createPeriodTimeMapping({
          periodNo: input.periodNo,
          periodName: input.periodName || `第${input.periodNo}节`,
          startTime: input.startTime,
          endTime: input.endTime,
        });
        return { id };
      }),

    // 更新节次时间
    updatePeriod: sysAdminProcedure
      .input(z.object({
        id: z.number(),
        periodNo: z.number().min(1).max(12).optional(),
        periodName: z.string().optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        
        // 如果同时更新了开始和结束时间，验证逻辑
        if (data.startTime && data.endTime) {
          const [startHour, startMin] = data.startTime.split(':').map(Number);
          const [endHour, endMin] = data.endTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          if (startMinutes >= endMinutes) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '开始时间必须早于结束时间' });
          }
        }

        await db.updatePeriodTimeMapping(id, data);
        return { success: true };
      }),

    // 删除节次时间
    deletePeriod: sysAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePeriodTimeMapping(input.id);
        return { success: true };
      }),

    // 获取当前学期
    getCurrentSemester: publicProcedure.query(async () => {
      return await db.getCurrentSemester();
    }),

    // 获取所有学期
    getAllSemesters: publicProcedure.query(async () => {
      return await db.getAllSemesters();
    }),

    // ============ 课程排课管理 ============

    // 获取课表总览（所有已审批排课，支持按实验室筛选）
    getScheduleBoard: protectedProcedure
      .input(z.object({ labId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllApprovedSchedules(input?.labId);
      }),

    // 获取课程排课
    getCourseSchedules: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCourseSchedules(input.courseId);
      }),

    // 添加课程排课
    addSchedule: teacherProcedure
      .input(z.object({
        courseId: z.number(),
        labId: z.number(),
        dayOfWeek: z.number().min(1).max(7),
        startPeriod: z.number().min(1).max(12),
        endPeriod: z.number().min(1).max(12),
        weekStart: z.number().min(1).default(1),
        weekEnd: z.number().min(1).default(18),
        weekType: z.enum(['all', 'odd', 'even']).default('all'),
      }))
      .mutation(async ({ ctx, input }) => {
        // 验证课程所有权
        const course = await db.getCourseById(input.courseId);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此课程' });
        }

        // 验证节次范围
        if (input.startPeriod > input.endPeriod) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '开始节次不能大于结束节次' });
        }

        // 检查与其他课程排课的冲突
        const conflicts = await db.checkScheduleConflict({
          labId: input.labId,
          dayOfWeek: input.dayOfWeek,
          startPeriod: input.startPeriod,
          endPeriod: input.endPeriod,
          startWeek: input.weekStart,
          endWeek: input.weekEnd,
          weekType: input.weekType,
        });

        if (conflicts.length > 0) {
          const conflictInfo = conflicts.map(c => 
            `${c.courseName}（周${c.startWeek}-${c.endWeek}，第${c.startPeriod}-${c.endPeriod}节）`
          ).join('、');
          throw new TRPCError({ 
            code: 'CONFLICT', 
            message: `与以下课程时间冲突：${conflictInfo}` 
          });
        }

        // 检查与个人预约的冲突
        const reservationConflicts = await db.checkScheduleConflictWithReservation({
          labId: input.labId,
          dayOfWeek: input.dayOfWeek,
          startPeriod: input.startPeriod,
          endPeriod: input.endPeriod,
          startWeek: input.weekStart,
          endWeek: input.weekEnd,
          weekType: input.weekType,
        });

        if (reservationConflicts.hasConflict) {
          const conflictInfo = reservationConflicts.conflicts.slice(0, 3).map(c => 
            `"${c.title}"（第${c.weekNo}周）`
          ).join('、');
          const moreCount = reservationConflicts.conflicts.length - 3;
          throw new TRPCError({ 
            code: 'CONFLICT', 
            message: `与以下预约时间冲突：${conflictInfo}${moreCount > 0 ? `等${reservationConflicts.conflicts.length}条` : ''}` 
          });
        }

        const id = await db.addCourseSchedule({
          courseId: input.courseId,
          labId: input.labId,
          dayOfWeek: input.dayOfWeek,
          startPeriod: input.startPeriod,
          endPeriod: input.endPeriod,
          startWeek: input.weekStart,
          endWeek: input.weekEnd,
          weekType: input.weekType,
        });

        return { id };
      }),

    // 更新课程排课
    updateSchedule: teacherProcedure
      .input(z.object({
        id: z.number(),
        labId: z.number().optional(),
        dayOfWeek: z.number().min(1).max(7).optional(),
        startPeriod: z.number().min(1).max(12).optional(),
        endPeriod: z.number().min(1).max(12).optional(),
        weekStart: z.number().min(1).optional(),
        weekEnd: z.number().min(1).optional(),
        weekType: z.enum(['all', 'odd', 'even']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const schedules = await db.getCourseSchedules(input.id);
        // 需要根据 schedule 找到 course 验证权限
        // 简化处理：直接更新
        await db.updateCourseSchedule(input.id, input);
        return { success: true };
      }),

    // 删除课程排课
    deleteSchedule: teacherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCourseSchedule(input.id);
        return { success: true };
      }),

    // ============ 课程排课审批（管理员） ============

    // 获取待审批的排课列表
    getPendingSchedules: scheduleApproveProcedure
      .input(z.object({
        labId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getPendingSchedules(input?.labId);
      }),

    // 审批通过排课
    approveSchedule: scheduleApproveProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.approveSchedule(input.id, ctx.user.id);
        
        // 获取排课信息发送通知
        const schedule = await db.getScheduleById(input.id);
        if (schedule) {
          const course = await db.getCourseById(schedule.courseId);
          if (course) {
            await db.createNotification({
              userId: course.teacherId,
              type: 'system',
              title: '排课审批通过',
              content: `您的课程「${course.name}」排课申请已通过审批`,
              relatedType: 'course_schedule',
              relatedId: input.id,
            });
          }
        }
        
        return { success: true };
      }),

    // 拒绝排课
    rejectSchedule: scheduleApproveProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.rejectSchedule(input.id, input.reason);
        
        // 获取排课信息发送通知
        const schedule = await db.getScheduleById(input.id);
        if (schedule) {
          const course = await db.getCourseById(schedule.courseId);
          if (course) {
            await db.createNotification({
              userId: course.teacherId,
              type: 'system',
              title: '排课审批被拒绝',
              content: `您的课程「${course.name}」排课申请被拒绝${input.reason ? `，原因：${input.reason}` : ''}`,
              relatedType: 'course_schedule',
              relatedId: input.id,
            });
          }
        }
        
        return { success: true };
      }),

    // ============ 学期配置管理（管理员） ============
    
    // 创建学期
    createSemester: adminProcedure
      .input(z.object({
        name: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        weekCount: z.number().default(18),
        isCurrent: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        // 生成学期代码，基于时间
        const semesterCode = `${new Date(input.startDate).getFullYear()}-${Date.now()}`;
        const id = await db.createSemester({
          semesterCode,
          semesterName: input.name,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          weekCount: input.weekCount,
          isCurrent: input.isCurrent,
        });
        return { id };
      }),

    // 更新学期
    updateSemester: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        weekCount: z.number().optional(),
        isCurrent: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, name, startDate, endDate, ...rest } = input;
        await db.updateSemester(id, {
          ...rest,
          ...(name && { semesterName: name }),
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
        });
        return { success: true };
      }),

    // 删除学期
    deleteSemester: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSemester(input.id);
        return { success: true };
      }),

    // 设为当前学期
    setCurrentSemester: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateSemester(input.id, { isCurrent: 1 });
        return { success: true };
      }),

    // 计算当前周次
    getCurrentWeek: publicProcedure.query(async () => {
      const semester = await db.getCurrentSemester();
      if (!semester) return { weekNo: 1, semester: null };
      const weekNo = db.calculateCurrentWeek(new Date(semester.startDate));
      return { weekNo, semester };
    }),

    // 批量导入排课（管理员）
    batchImportSchedules: adminProcedure
      .input(z.object({
        rows: z.array(z.object({
          courseName: z.string().optional(),
          courseNo: z.string(),
          teacherName: z.string().optional(),
          labRoomNo: z.string(),
          dayOfWeek: z.number().min(1).max(7),
          startPeriod: z.number().min(1).max(12),
          endPeriod: z.number().min(1).max(12),
          weekStart: z.number().min(1).default(1),
          weekEnd: z.number().min(1).default(18),
          weekType: z.enum(['all', 'odd', 'even']).default('all'),
        })),
        autoApprove: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const results: { row: number; success: boolean; message: string }[] = [];

        for (let i = 0; i < input.rows.length; i++) {
          const row = input.rows[i];
          try {
            // 查找课程
            const course = await db.getCourseByNo(row.courseNo);
            if (!course) {
              results.push({ row: i + 1, success: false, message: `课程编号 "${row.courseNo}" 不存在` });
              continue;
            }

            // 查找实验室
            const lab = await db.getLabRoomByNo(row.labRoomNo);
            if (!lab) {
              results.push({ row: i + 1, success: false, message: `实验室编号 "${row.labRoomNo}" 不存在` });
              continue;
            }

            if (row.startPeriod > row.endPeriod) {
              results.push({ row: i + 1, success: false, message: '开始节次不能大于结束节次' });
              continue;
            }

            // 检查与其他排课的冲突
            const scheduleConflicts = await db.checkScheduleConflict({
              labId: lab.id,
              dayOfWeek: row.dayOfWeek,
              startPeriod: row.startPeriod,
              endPeriod: row.endPeriod,
              startWeek: row.weekStart,
              endWeek: row.weekEnd,
              weekType: row.weekType,
            });

            if (scheduleConflicts.length > 0) {
              const conflictInfo = scheduleConflicts.map(c =>
                `${c.courseName}（第${c.startPeriod}-${c.endPeriod}节）`
              ).join('、');
              results.push({ row: i + 1, success: false, message: `与排课冲突：${conflictInfo}` });
              continue;
            }

            // 检查与个人预约的冲突
            const reservationConflicts = await db.checkScheduleConflictWithReservation({
              labId: lab.id,
              dayOfWeek: row.dayOfWeek,
              startPeriod: row.startPeriod,
              endPeriod: row.endPeriod,
              startWeek: row.weekStart,
              endWeek: row.weekEnd,
              weekType: row.weekType,
            });

            if (reservationConflicts.hasConflict && reservationConflicts.conflicts.length > 0) {
              const conflictInfo = reservationConflicts.conflicts.map(c =>
                `${c.title}（第${c.weekNo}周，${new Date(c.startTime).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}）`
              ).join('、');
              results.push({ row: i + 1, success: false, message: `与个人预约冲突：${conflictInfo}` });
              continue;
            }

            // 插入
            const id = await db.addCourseSchedule({
              courseId: course.id,
              labId: lab.id,
              dayOfWeek: row.dayOfWeek,
              startPeriod: row.startPeriod,
              endPeriod: row.endPeriod,
              startWeek: row.weekStart,
              endWeek: row.weekEnd,
              weekType: row.weekType,
            });

            // 自动审批
            if (input.autoApprove && id) {
              await db.approveSchedule(id, ctx.user.id);
            }

            const teacherInfo = row.teacherName ? `（${row.teacherName}）` : '';
            results.push({ row: i + 1, success: true, message: `${course.name}${teacherInfo} → ${lab.name} 导入成功` });
          } catch (err: any) {
            results.push({ row: i + 1, success: false, message: err.message || '未知错误' });
          }
        }

        const successCount = results.filter(r => r.success).length;
        return { results, successCount, totalCount: input.rows.length };
      }),

    // 教师开启签到会话
    startSession: teacherProcedure
      .input(z.object({
        courseId: z.number(),
        labId: z.number(),
        title: z.string().optional(),
        weekNo: z.number().optional(),
        allowLateMinutes: z.number().default(15),
        useGeofence: z.boolean().default(true),
        qrcodeRefreshSeconds: z.number().default(30),
      }))
      .mutation(async ({ ctx, input }) => {
        // 验证课程所有权
        const course = await db.getCourseById(input.courseId);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作此课程' });
        }

        // 检查是否已有活跃签到会话
        const existing = await db.getActiveCheckinSession(input.courseId);
        if (existing) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该课程已有进行中的签到，请先关闭' });
        }

        // 生成二维码令牌（6位数字签到码）
        const qrcodeToken = Math.floor(100000 + Math.random() * 900000).toString();
        const now = new Date();
        const qrcodeExpireAt = new Date(now.getTime() + (input.qrcodeRefreshSeconds * 1000));

        // 创建签到会话
        const sessionId = await db.createCheckinSession({
          courseId: input.courseId,
          labId: input.labId,
          sessionDate: now,
          weekNo: input.weekNo,
          teacherId: ctx.user.id,
          title: input.title,
          qrcodeToken,
          qrcodeExpireAt,
          qrcodeRefreshSeconds: input.qrcodeRefreshSeconds,
          allowLateMinutes: input.allowLateMinutes,
          useGeofence: input.useGeofence ? 1 : 0,
          status: 'active',
        });

        // 初始化学生出勤记录（全部默认缺勤）
        const studentCount = await db.initCourseAttendances(sessionId, input.courseId, now);

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'checkin_session_start',
          targetType: 'checkin_session',
          targetId: sessionId,
          details: JSON.stringify({ courseId: input.courseId, studentCount }),
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { sessionId, qrcodeToken, studentCount };
      }),

    // 刷新二维码令牌
    refreshQrcode: teacherProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getCheckinSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '签到会话不存在' });
        }
        if (session.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作' });
        }
        if (session.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '签到已结束' });
        }

        const qrcodeToken = Math.floor(100000 + Math.random() * 900000).toString();
        const qrcodeExpireAt = new Date(Date.now() + (session.qrcodeRefreshSeconds || 30) * 1000);

        await db.updateCheckinSession(input.sessionId, { qrcodeToken, qrcodeExpireAt });

        return { qrcodeToken, qrcodeExpireAt };
      }),

    // 教师关闭签到会话
    closeSession: teacherProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getCheckinSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '签到会话不存在' });
        }
        if (session.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作' });
        }
        if (session.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '签到已结束' });
        }

        await db.closeCheckinSession(input.sessionId);

        // 记录审计日志
        await db.createAuditLog({
          operatorUserId: ctx.user.id,
          operationType: 'checkin_session_close',
          targetType: 'checkin_session',
          targetId: input.sessionId,
          result: 'success',
          ipAddress: getClientIp(ctx.req),
        });

        return { success: true };
      }),

    // 获取签到会话详情（含出勤列表）
    getSessionDetail: teacherProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await db.getCheckinSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '签到会话不存在' });
        }
        if (session.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权查看' });
        }

        const attendances = await db.getSessionAttendances(input.sessionId);
        const course = await db.getCourseById(session.courseId);
        const lab = await db.getLabRoomById(session.labId);

        return {
          ...session,
          course: course ? { id: course.id, name: course.name, courseNo: course.courseNo } : null,
          lab: lab ? { id: lab.id, name: lab.name, roomNo: lab.roomNo } : null,
          attendances,
        };
      }),

    // 教师获取当前活跃的签到会话
    getActiveSession: teacherProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const course = await db.getCourseById(input.courseId);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权查看此课程' });
        }

        const session = await db.getActiveCheckinSession(input.courseId);
        if (!session) return null;

        const attendances = await db.getSessionAttendances(session.id);
        return { ...session, attendances };
      }),

    // 教师手动更新学生出勤状态
    updateAttendance: teacherProcedure
      .input(z.object({
        sessionId: z.number(),
        studentId: z.number(),
        status: z.enum(['present', 'late', 'absent', 'leave']),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getCheckinSessionById(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '签到会话不存在' });
        }
        if (session.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权操作' });
        }

        await db.updateAttendanceStatus(input.sessionId, input.studentId, input.status, input.note);

        return { success: true };
      }),

    // 教师获取签到历史
    getHistory: teacherProcedure
      .input(z.object({ courseId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getTeacherCheckinHistory(ctx.user.id, input.courseId);
      }),

    // 获取课程出勤统计
    getCourseStats: teacherProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const course = await db.getCourseById(input.courseId);
        if (!course || course.teacherId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权查看此课程' });
        }
        return await db.getCourseAttendanceStats(input.courseId);
      }),

    // ======= 学生端 API =======

    // 学生获取可签到的课程
    getActiveCheckins: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'student') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '仅学生可访问' });
      }
      return await db.getStudentActiveCheckins(ctx.user.id);
    }),

    // 学生扫码签到
    studentCheckin: protectedProcedure
      .input(z.object({
        token: z.string(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'student') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅学生可签到' });
        }

        // 通过令牌找到签到会话
        const session = await db.getCheckinSessionByToken(input.token);
        if (!session) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '二维码无效或已过期' });
        }

        // 检查二维码是否过期
        if (session.qrcodeExpireAt && new Date() > new Date(session.qrcodeExpireAt)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '二维码已过期，请刷新后重试' });
        }

        // 检查学生是否在该课程
        const enrollment = await db.getCourseStudents(session.courseId);
        const isEnrolled = enrollment.some(e => e.studentId === ctx.user.id);
        if (!isEnrolled) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '您未加入此课程' });
        }

        // 如果启用地理围栏，验证位置
        if (session.useGeofence && input.latitude && input.longitude) {
          const geofence = await db.getLabGeofence(session.labId);
          if (geofence) {
            const distance = calculateDistance(
              input.latitude, input.longitude,
              parseFloat(geofence.latitude as string), parseFloat(geofence.longitude as string)
            );
            if (distance > (geofence.radius || 100)) {
              throw new TRPCError({ 
                code: 'BAD_REQUEST', 
                message: `您不在签到范围内（距离${Math.round(distance)}米）` 
              });
            }
          }
        }

        // 执行签到
        const result = await db.studentCheckin({
          sessionId: session.id,
          studentId: ctx.user.id,
          method: 'qrcode',
          latitude: input.latitude,
          longitude: input.longitude,
        });

        return {
          success: true,
          status: result.status,
          message: result.status === 'late' ? `签到成功（迟到${result.minutesLate}分钟）` : '签到成功',
        };
      }),

    // 学生位置签到（不需要扫码）
    studentGeofenceCheckin: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        latitude: z.number(),
        longitude: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'student') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅学生可签到' });
        }

        const session = await db.getCheckinSessionById(input.sessionId);
        if (!session || session.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '签到会话不存在或已结束' });
        }

        // 检查学生是否在该课程
        const enrollment = await db.getCourseStudents(session.courseId);
        const isEnrolled = enrollment.some(e => e.studentId === ctx.user.id);
        if (!isEnrolled) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '您未加入此课程' });
        }

        // 位置签到必须有地理围栏配置
        const geofence = await db.getLabGeofence(session.labId);
        if (!geofence) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: '该实验室未配置地理围栏，无法使用位置签到，请联系教师' 
          });
        }

        // 验证是否在围栏范围内
        const distance = calculateDistance(
          input.latitude, input.longitude,
          parseFloat(geofence.latitude as string), parseFloat(geofence.longitude as string)
        );
        if (distance > (geofence.radius || 100)) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `您不在签到范围内（距离${Math.round(distance)}米）` 
          });
        }

        // 执行签到
        const result = await db.studentCheckin({
          sessionId: input.sessionId,
          studentId: ctx.user.id,
          method: 'geofence',
          latitude: input.latitude,
          longitude: input.longitude,
        });

        return {
          success: true,
          status: result.status,
          message: result.status === 'late' ? `签到成功（迟到${result.minutesLate}分钟）` : '签到成功',
        };
      }),

    // 学生查看自己的课程出勤记录
    getMyAttendance: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getStudentCourseAttendances(ctx.user.id, input.courseId);
      }),
  }),
});

// 计算两点间距离（米）
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // 地球半径（米）
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export type AppRouter = typeof appRouter;