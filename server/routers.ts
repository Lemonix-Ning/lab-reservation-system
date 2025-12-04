import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { xfspark } from "./_core/xfspark";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

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

// 管理员权限检查
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理员权限' });
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
    
    // 管理员查看所有预约
    allList: adminProcedure.query(async () => {
      const reservations = await db.getAllReservations();
      // 关联实验室和用户信息
      const roomIds = Array.from(new Set(reservations.map(r => r.labId)));
      const rooms = await Promise.all(roomIds.map(id => db.getLabRoomById(id)));
      const roomMap = new Map(rooms.filter(r => r).map(r => [r!.id, r!]));
      
      return reservations.map(r => ({
        ...r,
        labRoom: roomMap.get(r.labId),
      }));
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
        
        // 2. 检查时间合法性
        if (input.startTime >= input.endTime) {
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
    approve: adminProcedure
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
    reject: adminProcedure
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
  }),

  // ============ 预约规则管理 ============
  rule: router({
    list: adminProcedure.query(async () => {
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
    
    update: adminProcedure
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

    // 管理员创建或更新审批配置
    updateConfig: adminProcedure
      .input(z.object({
        id: z.number().optional(),
        labId: z.number().nullable(),
        name: z.string(),
        enableMultiLevel: z.number(),
        approvalStages: z.string(), // JSON string
        rescheduleWindowHours: z.number().optional(),
        maxRescheduleCount: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          if (input.id) {
            await db.updateApprovalConfig(input.id, {
              ...input,
              id: undefined,
            });
          } else {
            await db.createApprovalConfig({
              ...input,
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
    recordViolation: adminProcedure
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
    removeBlacklist: adminProcedure
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
  }),

  // ============ 审计日志 ============
  audit: router({
    // 查询审计日志
    getLogs: adminProcedure
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
      .mutation(async ({ input }) => {
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
      .mutation(async ({ input }) => {
        try {
          const result = await xfspark.generateInsight(input);
          return { text: result };
        } catch (error) {
          const message = error instanceof Error ? error.message : '生成失败';
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
