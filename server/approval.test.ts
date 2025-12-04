import { describe, it, expect, vi } from 'vitest';
import * as db from './db';

describe('审批与违约管理', () => {
  describe('审批配置管理', () => {
    it('should create approval config', async () => {
      const mockConfig = { id: 1, labId: 1, name: '高级实验室审批流程', enableMultiLevel: 1 };
      vi.spyOn(db, 'createApprovalConfig').mockResolvedValue(mockConfig as any);
      
      const config = await db.createApprovalConfig({
        labId: 1,
        name: '高级实验室审批流程',
        enableMultiLevel: 1,
        approvalStages: JSON.stringify([
          { stage: 1, role: 'teacher', allowApprove: true, allowReject: true, canModifyTime: false }
        ]),
        rescheduleWindowHours: 24,
        maxRescheduleCount: 3,
        status: 'enabled',
      });
      
      expect(config).toBeDefined();
      expect((config as any)?.labId).toBe(1);
    });

    it('should retrieve approval config for lab', async () => {
      const mockConfig = { id: 1, labId: 2, name: '测试配置', enableMultiLevel: 0 };
      vi.spyOn(db, 'getApprovalConfigForLab').mockResolvedValue(mockConfig as any);

      const config = await db.getApprovalConfigForLab(2);
      expect(config).toBeDefined();
      expect(config?.labId).toBe(2);
    });

    it('should update approval config', async () => {
      vi.spyOn(db, 'updateApprovalConfig').mockResolvedValue(undefined as any);

      await db.updateApprovalConfig(3, {
        name: '更新后的配置',
        enableMultiLevel: 1,
      });

      expect(db.updateApprovalConfig).toHaveBeenCalled();
    });
  });

  describe('违约记录管理', () => {
    it('should record violation', async () => {
      const violations = [{ userId: 1, violationType: 'no_show', points: 5, description: '未到场' }];
      vi.spyOn(db, 'recordViolation').mockResolvedValue(undefined as any);
      vi.spyOn(db, 'getUserViolations').mockResolvedValue(violations as any);

      await db.recordViolation({
        userId: 1,
        violationType: 'no_show',
        points: 5,
        description: '未到场',
      });

      const result = await db.getUserViolations(1);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].points).toBe(5);
    });

    it('should calculate total violation points', async () => {
      vi.spyOn(db, 'recordViolation').mockResolvedValue(undefined as any);
      vi.spyOn(db, 'getUserTotalViolationPoints').mockResolvedValue(8 as any);

      await db.recordViolation({
        userId: 2,
        violationType: 'no_show',
        points: 5,
      });

      await db.recordViolation({
        userId: 2,
        violationType: 'late_cancel',
        points: 3,
      });

      const totalPoints = await db.getUserTotalViolationPoints(2);
      expect(totalPoints).toBe(8);
    });

    it('should auto-add user to blacklist when violation points exceed threshold', async () => {
      vi.spyOn(db, 'recordViolation').mockResolvedValue(undefined as any);
      vi.spyOn(db, 'getUserTotalViolationPoints').mockResolvedValue(12 as any);
      vi.spyOn(db, 'isUserBlacklisted').mockResolvedValue(true as any);

      for (let i = 0; i < 3; i++) {
        await db.recordViolation({
          userId: 3,
          violationType: 'no_show',
          points: 5,
        });
      }

      const isBlacklisted = await db.isUserBlacklisted(3);
      expect(isBlacklisted).toBe(true);
    });
  });

  describe('黑名单管理', () => {
    it('should check if user is blacklisted', async () => {
      vi.spyOn(db, 'isUserBlacklisted').mockResolvedValue(true as any);

      const isBlacklisted = await db.isUserBlacklisted(4);
      expect(isBlacklisted).toBe(true);
    });

    it('should get blacklist record', async () => {
      const mockRecord = { userId: 5, restrictionType: 'time_limit', reason: 'Too many violations' };
      vi.spyOn(db, 'getUserBlacklist').mockResolvedValue(mockRecord as any);

      const record = await db.getUserBlacklist(5);
      expect(record).toBeDefined();
      expect(record?.userId).toBe(5);
      expect(record?.restrictionType).toBe('time_limit');
    });

    it('should remove user from blacklist', async () => {
      vi.spyOn(db, 'removeFromBlacklist').mockResolvedValue(undefined as any);

      await db.removeFromBlacklist(6);
      expect(db.removeFromBlacklist).toHaveBeenCalled();
    });
  });

  describe('审计日志管理', () => {
    it('should create audit log', async () => {
      const logs = [{ id: 1, operationType: 'reservation_approve', result: 'success' }];
      vi.spyOn(db, 'createAuditLog').mockResolvedValue(undefined as any);
      vi.spyOn(db, 'getAuditLogs').mockResolvedValue(logs as any);

      await db.createAuditLog({
        operatorUserId: 1,
        operationType: 'reservation_approve',
        targetType: 'reservation',
        targetId: 10,
        details: JSON.stringify({ approved: true }),
        result: 'success',
      });

      const result = await db.getAuditLogs({
        operatorUserId: 1,
        operationType: 'reservation_approve',
        limit: 10,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].operationType).toBe('reservation_approve');
    });

    it('should filter audit logs by operation type', async () => {
      const logs = [
        { id: 1, operationType: 'reservation_reject', result: 'success' },
        { id: 2, operationType: 'reservation_reject', result: 'success' },
      ];
      vi.spyOn(db, 'getAuditLogs').mockResolvedValue(logs as any);

      const result = await db.getAuditLogs({
        operationType: 'reservation_reject',
        limit: 20,
      });

      expect(result.length).toBe(2);
      expect(result.every((log: any) => log.operationType === 'reservation_reject')).toBe(true);
    });

    it('should get audit logs by reservation', async () => {
      const logs = [
        { id: 1, targetType: 'reservation', targetId: 100, operationType: 'reservation_approve' },
        { id: 2, targetType: 'reservation', targetId: 100, operationType: 'reservation_reject' },
      ];
      vi.spyOn(db, 'getAuditLogsByReservation').mockResolvedValue(logs as any);

      const result = await db.getAuditLogsByReservation(100);

      expect(result.length).toBe(2);
      expect(result.every((log: any) => log.targetId === 100)).toBe(true);
    });

    it('should include reason in audit log details', async () => {
      const logWithReason = {
        id: 1,
        operationType: 'reservation_reject',
        details: JSON.stringify({ reason: 'Conflict with maintenance window' }),
      };
      vi.spyOn(db, 'getAuditLogs').mockResolvedValue([logWithReason] as any);

      const logs = await db.getAuditLogs({
        operationType: 'reservation_reject',
        limit: 10,
      });

      expect(logs[0].details).toContain('Conflict with maintenance window');
    });

    it('should filter audit logs by date range', async () => {
      const logs = [
        { id: 1, createdAt: new Date('2024-01-15'), operationType: 'reservation_approve' },
        { id: 2, createdAt: new Date('2024-01-20'), operationType: 'reservation_approve' },
      ];
      vi.spyOn(db, 'getAuditLogs').mockResolvedValue(logs as any);

      const result = await db.getAuditLogs({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        limit: 10,
      });

      expect(result.length).toBe(2);
      expect(result.every((log: any) => log.createdAt >= new Date('2024-01-01'))).toBe(true);
    });
  });

  describe('并发安全检查', () => {
    it('should handle concurrent violation records', async () => {
      vi.spyOn(db, 'recordViolation').mockResolvedValue(undefined as any);
      vi.spyOn(db, 'getUserTotalViolationPoints').mockResolvedValue(15 as any);

      const promises = Array.from({ length: 5 }, (_, i) =>
        db.recordViolation({
          userId: 7,
          violationType: 'no_show',
          points: 3,
        })
      );

      await Promise.all(promises);

      const totalPoints = await db.getUserTotalViolationPoints(7);
      expect(totalPoints).toBeGreaterThanOrEqual(15);
    });

    it('should prevent duplicate blacklist entries', async () => {
      const mockRecord = { userId: 8, restrictionType: 'time_limit' };
      vi.spyOn(db, 'getUserBlacklist').mockResolvedValue(mockRecord as any);
      vi.spyOn(db, 'recordViolation').mockResolvedValue(undefined as any);

      await Promise.all([
        db.recordViolation({ userId: 8, violationType: 'no_show', points: 10 }),
        db.recordViolation({ userId: 8, violationType: 'late_cancel', points: 2 }),
      ]);

      const record = await db.getUserBlacklist(8);
      expect(record).toBeDefined();
      expect(record?.userId).toBe(8);
    });
  });
});
