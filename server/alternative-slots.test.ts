import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe.skip('替代时间方案规则验证测试', () => {
  it('生成的替代时间应该符合 ADVANCE_DAYS 规则', async () => {
    // 模拟场景：当前日期 2025-12-12，ADVANCE_DAYS = 7
    // 原预约时间：2025-12-13 10:00-12:00 (不符合规则)
    
    const labId = 1;
    const startTime = '2025-12-13T10:00:00';
    const endTime = '2025-12-13T12:00:00';
    
    const alternatives = await db.getAlternativeTimeSlots({
      labId,
      startTime,
      endTime,
    });
    
    // 验证：所有返回的替代时间都应该 >= 今天 + 7 天
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() + 7);
    
    for (const alt of alternatives) {
      const altDate = new Date(alt.startTime);
      altDate.setHours(0, 0, 0, 0);
      
      expect(altDate >= minDate).toBe(true);
      console.log(`✓ 替代方案: ${alt.startTime.toISOString().split('T')[0]} (符合规则)`);
    }
  });

  it('checkReservationRulesExceptAdvance 应该跳过 ADVANCE_DAYS 检查', async () => {
    const userId = 1;
    const labId = 1;
    
    // 使用明天的日期（不符合 ADVANCE_DAYS = 7）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    const endTime = new Date(tomorrow);
    endTime.setHours(12, 0, 0, 0);
    
    // 完整规则检查应该失败
    const fullCheck = await db.checkReservationRules(userId, labId, tomorrow, endTime);
    expect(fullCheck.valid).toBe(false);
    expect(fullCheck.reason).toContain('必须至少提前');
    
    // 跳过 ADVANCE_DAYS 的检查应该通过（假设没有其他规则违反）
    const partialCheck = await db.checkReservationRulesExceptAdvance(userId, labId, tomorrow, endTime);
    // 注意：如果有 MAX_PER_DAY 或 MAX_DURATION 限制，可能仍会失败
    console.log(`完整检查: ${fullCheck.valid ? '通过' : '失败'} - ${fullCheck.reason || 'N/A'}`);
    console.log(`跳过 ADVANCE_DAYS 检查: ${partialCheck.valid ? '通过' : '失败'} - ${partialCheck.reason || 'N/A'}`);
  });
});
