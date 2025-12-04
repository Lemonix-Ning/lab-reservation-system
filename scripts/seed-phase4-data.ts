import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { approvalConfigs, approvalHistories, violationRecords, blacklist, auditLogs } from "../drizzle/schema";

const pool = await mysql.createPool(process.env.DATABASE_URL ?? "");
const db = drizzle(pool);

async function seedPhase4Data() {
  console.log("🌱 Phase 4 测试数据初始化...\n");

  try {
    const connection = await pool.getConnection();
    
    // 1. 获取现有用户和预约数据
    console.log("📊 查询现有数据...");
    const [usersResult] = await connection.query('SELECT id, name, role FROM users LIMIT 10');
    const [reservationsResult] = await connection.query('SELECT id, userId, labId FROM lab_reservations LIMIT 10');
    const users = usersResult as any[];
    const reservations = reservationsResult as any[];
    
    if (users.length === 0) {
      console.log("⚠️  数据库中没有用户，请先运行 pnpm seed");
      connection.release();
      await pool.end();
      return;
    }
    
    console.log(`✅ 找到 ${users.length} 个用户, ${reservations.length} 个预约\n`);
    
    // 找到管理员和普通用户
    const adminUser = users.find(u => u.role === 'admin') || users[0];
    const regularUsers = users.filter(u => u.role === 'user' || u.role === 'student');
    
    // 2. 插入审批配置
    console.log("📋 插入审批配置...");
    
    // 全局默认配置
    await connection.query(`
      INSERT INTO approval_configs 
      (labId, name, enableMultiLevel, approvalStages, rescheduleWindowHours, maxRescheduleCount, status)
      VALUES 
      (NULL, '全局默认审批流程', 0, '[]', 24, 2, 'enabled')
      ON DUPLICATE KEY UPDATE name=name
    `);
    
    // 实验室1的多级审批配置
    await connection.query(`
      INSERT INTO approval_configs 
      (labId, name, enableMultiLevel, approvalStages, rescheduleWindowHours, maxRescheduleCount, status)
      VALUES 
      (1, '高级实验室审批流程', 1, 
       '[{"stage":1,"role":"teacher","allowApprove":true,"allowReject":true,"canModifyTime":false},
         {"stage":2,"role":"admin","allowApprove":true,"allowReject":true,"canModifyTime":true}]',
       48, 1, 'enabled')
      ON DUPLICATE KEY UPDATE name=name
    `);
    
    console.log("✅ 审批配置插入成功\n");
    
    // 3. 插入违约记录
    console.log("🚫 插入违约记录...");
    
    if (regularUsers.length > 0) {
      // 用户1: 2次违约，总分7分（未达黑名单阈值）
      const user1 = regularUsers[0];
      await connection.query(`
        INSERT INTO violation_records (userId, violationType, points, description, reservationId)
        VALUES 
        (?, 'no_show', 5, '实验课无故缺席', ?),
        (?, 'late_cancel', 2, '临时取消预约（提前不足24小时）', NULL)
        ON DUPLICATE KEY UPDATE userId=userId
      `, [user1.id, reservations[0]?.id || null, user1.id]);
      console.log(`  - ${user1.name}: 2次违约，总分7分（正常状态）`);
      
      // 用户2: 3次违约，总分12分（应该在黑名单）
      if (regularUsers.length > 1) {
        const user2 = regularUsers[1];
        await connection.query(`
          INSERT INTO violation_records (userId, violationType, points, description, reservationId)
          VALUES 
          (?, 'no_show', 5, '第一次无故缺席', ?),
          (?, 'no_show', 5, '第二次无故缺席', ?),
          (?, 'late_cancel', 2, '临时取消预约', NULL)
          ON DUPLICATE KEY UPDATE userId=userId
        `, [
          user2.id, reservations[1]?.id || null,
          user2.id, reservations[2]?.id || null,
          user2.id
        ]);
        console.log(`  - ${user2.name}: 3次违约，总分12分（应被加入黑名单）`);
        
        // 添加到黑名单
        await connection.query(`
          INSERT INTO blacklist 
          (userId, totalViolationPoints, violationThreshold, restrictionType, restrictedUntil, restrictedLabIds, reason)
          VALUES 
          (?, 12, 10, 'time_limit', DATE_ADD(NOW(), INTERVAL 7 DAY), NULL, '违约积分超过10分')
          ON DUPLICATE KEY UPDATE userId=userId
        `, [user2.id]);
        console.log(`  - ${user2.name}: 已加入黑名单（7天限制）`);
      }
      
      // 用户3: 1次违约，总分5分（正常状态）
      if (regularUsers.length > 2) {
        const user3 = regularUsers[2];
        await connection.query(`
          INSERT INTO violation_records (userId, violationType, points, description)
          VALUES 
          (?, 'no_show', 5, '实验课迟到超过30分钟')
          ON DUPLICATE KEY UPDATE userId=userId
        `, [user3.id]);
        console.log(`  - ${user3.name}: 1次违约，总分5分（正常状态）`);
      }
      
      // 用户4: 已解除黑名单的用户
      if (regularUsers.length > 3) {
        const user4 = regularUsers[3];
        await connection.query(`
          INSERT INTO violation_records (userId, violationType, points, description, reservationId)
          VALUES 
          (?, 'no_show', 5, '历史违约1', NULL),
          (?, 'no_show', 5, '历史违约2', NULL)
          ON DUPLICATE KEY UPDATE userId=userId
        `, [user4.id, user4.id]);
        
        await connection.query(`
          INSERT INTO blacklist 
          (userId, totalViolationPoints, violationThreshold, restrictionType, restrictedUntil, reason)
          VALUES 
          (?, 10, 10, 'time_limit', DATE_SUB(NOW(), INTERVAL 7 DAY), '违约积分超过10分（已解除）')
          ON DUPLICATE KEY UPDATE userId=userId
        `, [user4.id]);
        console.log(`  - ${user4.name}: 历史黑名单用户（已解除）`);
      }
    }
    
    console.log("✅ 违约记录插入成功\n");
    
    // 4. 插入审批历史
    console.log("📝 插入审批历史...");
    
    if (reservations.length > 0) {
      // 为前3个预约添加审批历史
      for (let i = 0; i < Math.min(3, reservations.length); i++) {
        const res = reservations[i];
        await connection.query(`
          INSERT INTO approval_histories 
          (reservationId, approverUserId, approvalStage, decision, comment)
          VALUES 
          (?, ?, 1, 'approved', '实验内容合理，批准通过')
          ON DUPLICATE KEY UPDATE reservationId=reservationId
        `, [res.id, adminUser.id]);
      }
      console.log(`✅ 为 ${Math.min(3, reservations.length)} 个预约添加审批历史\n`);
    }
    
    // 5. 插入审计日志
    console.log("📊 插入审计日志...");
    
    const auditLogEntries = [
      {
        operatorUserId: adminUser.id,
        operationType: 'reservation_approve',
        targetType: 'reservation',
        targetId: reservations[0]?.id || 1,
        details: JSON.stringify({ approved: true, stage: 1 }),
        result: 'success',
        reason: '实验内容审核通过',
        ipAddress: '192.168.1.100'
      },
      {
        operatorUserId: adminUser.id,
        operationType: 'reservation_reject',
        targetType: 'reservation',
        targetId: reservations[1]?.id || 2,
        details: JSON.stringify({ rejected: true }),
        result: 'success',
        reason: '预约时间冲突',
        ipAddress: '192.168.1.100'
      },
      {
        operatorUserId: adminUser.id,
        operationType: 'violation_record',
        targetType: 'user',
        targetId: regularUsers[0]?.id || 3,
        details: JSON.stringify({ violationType: 'no_show', points: 5 }),
        result: 'success',
        ipAddress: '192.168.1.100'
      },
      {
        operatorUserId: adminUser.id,
        operationType: 'blacklist_add',
        targetType: 'user',
        targetId: regularUsers[1]?.id || 4,
        details: JSON.stringify({ restrictionType: 'time_limit', days: 7 }),
        result: 'success',
        reason: '违约积分超过阈值',
        ipAddress: '192.168.1.100'
      },
      {
        operatorUserId: adminUser.id,
        operationType: 'config_update',
        targetType: 'approval_config',
        targetId: 1,
        details: JSON.stringify({ field: 'rescheduleWindowHours', oldValue: 24, newValue: 48 }),
        result: 'success',
        ipAddress: '192.168.1.100'
      },
      {
        operatorUserId: regularUsers[0]?.id || 3,
        operationType: 'reservation_create',
        targetType: 'reservation',
        targetId: reservations[2]?.id || 3,
        details: JSON.stringify({ labId: 1, startTime: '2024-12-05 10:00:00' }),
        result: 'success',
        ipAddress: '192.168.1.50'
      },
      {
        operatorUserId: adminUser.id,
        operationType: 'blacklist_remove',
        targetType: 'user',
        targetId: regularUsers[3]?.id || 6,
        details: JSON.stringify({ removedBy: 'admin' }),
        result: 'success',
        reason: '用户申诉成功，解除限制',
        ipAddress: '192.168.1.100'
      }
    ];
    
    for (const log of auditLogEntries) {
      await connection.query(`
        INSERT INTO audit_logs 
        (operatorUserId, operationType, targetType, targetId, details, result, reason, ipAddress)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        log.operatorUserId,
        log.operationType,
        log.targetType,
        log.targetId,
        log.details,
        log.result,
        log.reason || null,
        log.ipAddress
      ]);
    }
    
    console.log(`✅ 插入 ${auditLogEntries.length} 条审计日志\n`);
    
    // 6. 输出测试数据统计
    console.log("📊 Phase 4 测试数据统计:");
    
    const [approvalConfigCount] = await connection.query('SELECT COUNT(*) as count FROM approval_configs');
    const [violationCount] = await connection.query('SELECT COUNT(*) as count FROM violation_records');
    const [blacklistCount] = await connection.query('SELECT COUNT(*) as count FROM blacklist');
    const [approvalHistoryCount] = await connection.query('SELECT COUNT(*) as count FROM approval_histories');
    const [auditLogCount] = await connection.query('SELECT COUNT(*) as count FROM audit_logs');
    
    console.log(`  - 审批配置: ${(approvalConfigCount as any)[0].count} 条`);
    console.log(`  - 违约记录: ${(violationCount as any)[0].count} 条`);
    console.log(`  - 黑名单: ${(blacklistCount as any)[0].count} 条`);
    console.log(`  - 审批历史: ${(approvalHistoryCount as any)[0].count} 条`);
    console.log(`  - 审计日志: ${(auditLogCount as any)[0].count} 条`);
    
    console.log("\n✨ Phase 4 测试数据初始化完成！\n");
    
    console.log("🧪 测试建议:");
    console.log("  1. 使用黑名单用户（第2个普通用户）尝试创建预约 → 应被拒绝");
    console.log("  2. 查看审计日志页面 → 应看到所有操作记录");
    console.log("  3. 查询违约记录 → 应看到多个用户的违约历史");
    console.log("  4. 管理员移除黑名单 → 用户恢复正常预约权限\n");
    
    connection.release();
  } catch (error) {
    console.error("❌ 初始化失败:", error);
    process.exit(1);
  }

  await pool.end();
}

seedPhase4Data();
