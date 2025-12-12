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

// 管理员权限检查（兼容旧系统）
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['admin', 'sysAdmin'].includes(ctx.user.role)) {
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

// 教师权限检查
const teacherProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['teacher', 'sysAdmin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要教师权限' });
  }
  return next({ ctx });
});

// 实验室管理员权限检查
const labAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['labAdmin', 'sysAdmin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要实验室管理员权限' });
  }
  return next({ ctx });
});

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
      .query(async () => {
        return await db.getAllUsers();
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
    
    create: adminProcedure
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
    
    update: adminProcedure
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
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLabRoom(input.id);
        return { success: true };
      }),
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
    allList: labAdminProcedure
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
        
        // 3. 检查时间冲突
        const hasConflict = await db.checkTimeConflict(input.labId, input.startTime, input.endTime);
        if (hasConflict) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该时间段已被预约' });
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
    
    // 审核通过
    approve: labAdminProcedure
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
    reject: labAdminProcedure
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
    list: labAdminProcedure.query(async () => {
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
    
    update: labAdminProcedure
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

    create: adminProcedure
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

    update: adminProcedure
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

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDevice(input.id);
        return { success: true };
      }),
  }),

  // ============ 统计分析 ============
  statistics: router({
    summary: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getStatisticsSummary(input.startDate, input.endDate);
      }),

    labUsage: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getLabUsageStatistics(input.startDate, input.endDate);
      }),

    userActivity: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return await db.getUserActivityRanking(input.limit, input.startDate, input.endDate);
      }),

    timeDistribution: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return await db.getReservationTimeDistribution(input.startDate, input.endDate);
      }),

    statusStatistics: adminProcedure
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
  }),

  // ============ 违约与黑名单管理 ============
  violation: router({
    // 获取用户的违约记录
    getRecords: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserViolations(ctx.user.id);
      }),

    // 管理员获取所有用户的违约记录
    getAllRecords: adminProcedure
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
    recordViolation: labAdminProcedure
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
    removeBlacklist: labAdminProcedure
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
    getAllBlacklist: labAdminProcedure
      .query(async () => {
        return await db.getAllBlacklistUsers();
      }),
  }),

  // ============ 审计日志 ============
  audit: router({
    // 查询审计日志
    getLogs: labAdminProcedure
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
  }),

  // ============ 课程预约管理（Phase 4 P1）============
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

        // 检查时间冲突
        const hasConflict = await db.checkTimeConflict(input.labId, input.startTime, input.endTime);
        if (hasConflict) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该时间段已被预约' });
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
    upsert: adminProcedure
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
    list: adminProcedure
      .input(z.object({
        labId: z.number().optional(),
        deviceId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getBlockedPeriods(input);
      }),

    // 创建禁用时段
    create: adminProcedure
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
    update: adminProcedure
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
        if (updateData.reason !== undefined) updateFields.reason = updateData.reason;
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
        // 通过 getReservationsByTimeRange 获取设备相关的预约
        const reservations = await db.getReservationsByTimeRange({
          startDate: input.startDate,
          endDate: input.endDate,
          deviceId: input.deviceId,
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
    getConflictingReservations: adminProcedure
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
});

export type AppRouter = typeof appRouter;

