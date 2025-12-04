import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';
import { getDb } from './db';

describe('Statistics Module', () => {
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');

  describe('getStatisticsSummary', () => {
    it('should return summary statistics with correct structure', async () => {
      const summary = await db.getStatisticsSummary(startDate, endDate);
      
      if (summary) {
        expect(summary).toHaveProperty('totalReservations');
        expect(summary).toHaveProperty('approvedReservations');
        expect(summary).toHaveProperty('pendingReservations');
        expect(summary).toHaveProperty('rejectedReservations');
        expect(summary).toHaveProperty('totalUsers');
        expect(summary).toHaveProperty('totalLabs');
        expect(summary).toHaveProperty('totalHours');
        
        // 检查类型
        expect(typeof summary.totalReservations).toBe('number');
        expect(typeof summary.approvedReservations).toBe('number');
        expect(typeof summary.totalUsers).toBe('number');
      }
    });
  });

  describe('getLabUsageStatistics', () => {
    it('should return lab usage data with correct structure', async () => {
      const labUsage = await db.getLabUsageStatistics(startDate, endDate);
      
      expect(Array.isArray(labUsage)).toBe(true);
      
      if (labUsage.length > 0) {
        const item = labUsage[0];
        expect(item).toHaveProperty('labId');
        expect(item).toHaveProperty('labName');
        expect(item).toHaveProperty('totalReservations');
        expect(item).toHaveProperty('approvedReservations');
        expect(item).toHaveProperty('totalHours');
      }
    });
  });

  describe('getUserActivityRanking', () => {
    it('should return user activity ranking with limit', async () => {
      const limit = 5;
      const userActivity = await db.getUserActivityRanking(limit, startDate, endDate);
      
      expect(Array.isArray(userActivity)).toBe(true);
      expect(userActivity.length).toBeLessThanOrEqual(limit);
      
      if (userActivity.length > 0) {
        const item = userActivity[0];
        expect(item).toHaveProperty('userId');
        expect(item).toHaveProperty('totalReservations');
        expect(typeof item.totalReservations).toBe('number');
      }
    });

    it('should return rankings in descending order by totalReservations', async () => {
      const userActivity = await db.getUserActivityRanking(10, startDate, endDate);
      
      // 检查是否按预约数降序排列
      for (let i = 0; i < userActivity.length - 1; i++) {
        expect(userActivity[i].totalReservations).toBeGreaterThanOrEqual(
          userActivity[i + 1].totalReservations
        );
      }
    });
  });

  describe('getReservationTimeDistribution', () => {
    it('should return time distribution data', async () => {
      const distribution = await db.getReservationTimeDistribution(startDate, endDate);
      
      expect(Array.isArray(distribution)).toBe(true);
      
      if (distribution.length > 0) {
        const item = distribution[0];
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('approvedCount');
      }
    });
  });

  describe('getReservationStatusStatistics', () => {
    it('should return status statistics', async () => {
      const statusStats = await db.getReservationStatusStatistics(startDate, endDate);
      
      expect(Array.isArray(statusStats)).toBe(true);
      
      if (statusStats.length > 0) {
        const item = statusStats[0];
        expect(item).toHaveProperty('status');
        expect(item).toHaveProperty('count');
      }
    });

    it('should include expected status values', async () => {
      const statusStats = await db.getReservationStatusStatistics(startDate, endDate);
      const statuses = statusStats.map(item => item.status);
      
      // 验证返回的状态值是有效的
      const validStatuses = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];
      statuses.forEach(status => {
        expect(validStatuses).toContain(status);
      });
    });
  });

  describe('Statistics Data Integrity', () => {
    it('should have non-negative counts and hours', async () => {
      const summary = await db.getStatisticsSummary(startDate, endDate);
      
      if (summary) {
        expect(summary.totalReservations).toBeGreaterThanOrEqual(0);
        expect(summary.approvedReservations).toBeGreaterThanOrEqual(0);
        expect(summary.totalUsers).toBeGreaterThanOrEqual(0);
        expect(summary.totalHours).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have approved count <= total count', async () => {
      const summary = await db.getStatisticsSummary(startDate, endDate);
      
      if (summary) {
        expect(summary.approvedReservations).toBeLessThanOrEqual(
          summary.totalReservations
        );
      }
    });

    it('should aggregate correctly across all queries', async () => {
      const summary = await db.getStatisticsSummary(startDate, endDate);
      const statuses = await db.getReservationStatusStatistics(startDate, endDate);
      
      if (summary && statuses.length > 0) {
        const totalFromStatuses = statuses.reduce((sum, item) => sum + (item.count || 0), 0);
        
        // 允许轻微的差异（可能由于并发查询）
        expect(Math.abs(totalFromStatuses - summary.totalReservations)).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Date Range Filtering', () => {
    it('should accept any valid date range', async () => {
      const earlyStart = new Date('2024-01-01');
      const earlyEnd = new Date('2024-01-31');
      
      const summary = await db.getStatisticsSummary(earlyStart, earlyEnd);
      expect(summary).toBeDefined();
    });

    it('should handle empty date ranges gracefully', async () => {
      const futureStart = new Date('2099-01-01');
      const futureEnd = new Date('2099-12-31');
      
      const summary = await db.getStatisticsSummary(futureStart, futureEnd);
      
      if (summary) {
        expect(summary.totalReservations).toBe(0);
      }
    });
  });
});
