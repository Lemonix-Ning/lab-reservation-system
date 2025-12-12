import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('日历与预约更新功能测试', () => {
  let testUserId: number;
  let testLabId: number;
  let testReservationId: number;

  beforeAll(async () => {
    // 创建测试用户
    await db.upsertUser({
      openId: 'test-calendar-user',
      name: '测试用户',
      email: 'test@example.com',
      role: 'student',
    });
    const user = await db.getUserByOpenId('test-calendar-user');
    testUserId = user!.id;

    // 创建测试实验室
    await db.createLabRoom({
      roomNo: 'TEST-CAL-001',
      name: '测试日历实验室',
      capacity: 50,
      status: 'enabled',
    });
    const labs = await db.getAllLabRooms();
    testLabId = labs.find(l => l.roomNo === 'TEST-CAL-001')!.id;

    // 创建测试预约
    await db.createReservation({
      userId: testUserId,
      labId: testLabId,
      title: '原始预约',
      startTime: new Date('2025-12-15 09:00:00'),
      endTime: new Date('2025-12-15 11:00:00'),
      status: 'pending',
    });
    const reservations = await db.getUserReservations(testUserId);
    testReservationId = reservations[0].id;
  });

  it('应该能够获取冲突的预约详情', async () => {
    // 创建一个冲突的预约
    await db.createReservation({
      userId: testUserId,
      labId: testLabId,
      title: '冲突预约',
      startTime: new Date('2025-12-15 10:00:00'),
      endTime: new Date('2025-12-15 12:00:00'),
      status: 'approved',
    });

    // 获取冲突详情
    const conflicts = await db.getConflictingReservations(
      testLabId,
      new Date('2025-12-15 09:00:00'),
      new Date('2025-12-15 11:00:00'),
      testReservationId
    );

    expect(conflicts).toBeDefined();
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].title).toBe('冲突预约');
  });

  it('应该能够检测时间冲突', async () => {
    const hasConflict = await db.checkTimeConflict(
      testLabId,
      new Date('2025-12-15 09:30:00'),
      new Date('2025-12-15 10:30:00')
    );

    expect(hasConflict).toBe(true);
  });

  it('应该能够更新预约时间', async () => {
    // 更新预约到无冲突时间
    await db.updateReservation(testReservationId, {
      startTime: new Date('2025-12-16 09:00:00'),
      endTime: new Date('2025-12-16 11:00:00'),
      status: 'pending',
    });

    const updated = await db.getReservationById(testReservationId);
    expect(updated).toBeDefined();
    expect(updated!.startTime.toISOString()).toContain('2025-12-16');
  });

  it('应该能够通过 ID 获取用户信息', async () => {
    const user = await db.getUserById(testUserId);
    expect(user).toBeDefined();
    expect(user!.name).toBe('测试用户');
  });

  it('更新后不应该有时间冲突', async () => {
    const hasConflict = await db.checkTimeConflict(
      testLabId,
      new Date('2025-12-16 09:00:00'),
      new Date('2025-12-16 11:00:00'),
      testReservationId
    );

    // 应该没有冲突（排除自己）
    expect(hasConflict).toBe(false);
  });
});
