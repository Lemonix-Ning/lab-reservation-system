import "dotenv/config";
import mysql from "mysql2/promise";

const pool = await mysql.createPool(process.env.DATABASE_URL ?? "");

async function createViolationUsers() {
  console.log("🌱 创建违约用户...\n");

  try {
    const connection = await pool.getConnection();

    // 1. 创建新用户
    console.log("👥 创建测试用户...");
    
    const testUsers = [
      {
        openId: "user_violation_1",
        name: "王小红",
        email: "wang.xiaohong@example.com",
        role: "user",
      },
      {
        openId: "user_violation_2",
        name: "李大明",
        email: "li.daming@example.com",
        role: "user",
      },
      {
        openId: "user_violation_3",
        name: "张三强",
        email: "zhang.sanqiang@example.com",
        role: "user",
      },
    ];

    const userIds: number[] = [];

    for (const user of testUsers) {
      await connection.query(
        `INSERT INTO users (openId, name, email, role, loginMethod, lastSignedIn)
         VALUES (?, ?, ?, ?, 'oauth', NOW())
         ON DUPLICATE KEY UPDATE name=name`,
        [user.openId, user.name, user.email, user.role]
      );

      const [result] = await connection.query(
        "SELECT id FROM users WHERE openId = ?",
        [user.openId]
      );
      const userId = (result as any[])[0].id;
      userIds.push(userId);
      console.log(`  ✅ 创建用户: ${user.name} (ID: ${userId})`);
    }

    // 2. 为第一个用户创建 5 分违约记录
    console.log("\n📝 创建违约记录...");

    const userId1 = userIds[0];
    await connection.query(
      `INSERT INTO violation_records (userId, violationType, points, description, recordedAt)
       VALUES (?, 'no_show', 5, '实验室预约无故缺席', NOW())`,
      [userId1]
    );
    console.log(`  ✅ ${testUsers[0].name}: 无故缺席 (5分)`);

    // 3. 为第二个用户创建 7 分违约记录（2个）
    const userId2 = userIds[1];
    await connection.query(
      `INSERT INTO violation_records (userId, violationType, points, description, recordedAt)
       VALUES 
       (?, 'no_show', 5, '第一次实验室预约无故缺席', NOW()),
       (?, 'late_cancel', 2, '提前不足24小时取消预约', NOW())`,
      [userId2, userId2]
    );
    console.log(`  ✅ ${testUsers[1].name}: 无故缺席 (5分) + 迟到取消 (2分) = 7分`);

    // 4. 为第三个用户创建 12 分违约记录（应触发黑名单）
    const userId3 = userIds[2];
    await connection.query(
      `INSERT INTO violation_records (userId, violationType, points, description, recordedAt)
       VALUES 
       (?, 'no_show', 5, '第一次实验室预约无故缺席', NOW()),
       (?, 'no_show', 5, '第二次实验室预约无故缺席', NOW()),
       (?, 'timeout_checkout', 3, '超时未签出实验室', NOW())`,
      [userId3, userId3, userId3]
    );
    console.log(`  ✅ ${testUsers[2].name}: 无故缺席 (5分) + 无故缺席 (5分) + 超时未签出 (3分) = 13分`);

    // 5. 为第三个用户添加到黑名单
    console.log("\n🚫 添加用户到黑名单...");
    await connection.query(
      `INSERT INTO blacklist 
       (userId, totalViolationPoints, violationThreshold, restrictionType, restrictedUntil, reason)
       VALUES (?, 13, 10, 'time_limit', DATE_ADD(NOW(), INTERVAL 7 DAY), '违约积分超过10分')
       ON DUPLICATE KEY UPDATE userId=userId`,
      [userId3]
    );
    console.log(`  ✅ ${testUsers[2].name}: 已加入黑名单（7天限制）`);

    // 6. 创建审计日志记录
    console.log("\n📊 创建审计日志...");
    
    const auditLogs = [
      {
        operatorUserId: 1,
        operationType: "violation_record",
        targetType: "user",
        targetId: userId1,
        details: JSON.stringify({ violationType: "no_show", points: 5 }),
        reason: "无故缺席一次",
        result: "success",
        ipAddress: "192.168.1.100",
      },
      {
        operatorUserId: 1,
        operationType: "violation_record",
        targetType: "user",
        targetId: userId2,
        details: JSON.stringify({ violationType: "no_show", points: 5 }),
        reason: "无故缺席一次",
        result: "success",
        ipAddress: "192.168.1.100",
      },
      {
        operatorUserId: 1,
        operationType: "violation_record",
        targetType: "user",
        targetId: userId2,
        details: JSON.stringify({ violationType: "late_cancel", points: 2 }),
        reason: "提前不足24小时取消",
        result: "success",
        ipAddress: "192.168.1.100",
      },
      {
        operatorUserId: 1,
        operationType: "violation_record",
        targetType: "user",
        targetId: userId3,
        details: JSON.stringify({ violationType: "no_show", points: 5 }),
        reason: "第一次无故缺席",
        result: "success",
        ipAddress: "192.168.1.100",
      },
      {
        operatorUserId: 1,
        operationType: "violation_record",
        targetType: "user",
        targetId: userId3,
        details: JSON.stringify({ violationType: "no_show", points: 5 }),
        reason: "第二次无故缺席",
        result: "success",
        ipAddress: "192.168.1.100",
      },
      {
        operatorUserId: 1,
        operationType: "violation_record",
        targetType: "user",
        targetId: userId3,
        details: JSON.stringify({ violationType: "timeout_checkout", points: 3 }),
        reason: "超时未签出",
        result: "success",
        ipAddress: "192.168.1.100",
      },
      {
        operatorUserId: 1,
        operationType: "blacklist_add",
        targetType: "user",
        targetId: userId3,
        details: JSON.stringify({ restrictionType: "time_limit", days: 7 }),
        reason: "违约积分超过阈值",
        result: "success",
        ipAddress: "192.168.1.100",
      },
    ];

    for (const log of auditLogs) {
      await connection.query(
        `INSERT INTO audit_logs 
         (operatorUserId, operationType, targetType, targetId, details, reason, result, ipAddress, operatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          log.operatorUserId,
          log.operationType,
          log.targetType,
          log.targetId,
          log.details,
          log.reason,
          log.result,
          log.ipAddress,
        ]
      );
    }
    console.log(`  ✅ 创建 ${auditLogs.length} 条审计日志\n`);

    // 7. 输出测试用户信息
    console.log("✨ 测试用户创建完成！\n");
    console.log("📋 用户列表：");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`1️⃣  ${testUsers[0].name} (ID: ${userId1})`);
    console.log(`   状态：正常使用者`);
    console.log(`   违约分：5分 (无故缺席1次)`);
    console.log(`   预约权限：✅ 可以继续预约\n`);

    console.log(`2️⃣  ${testUsers[1].name} (ID: ${userId2})`);
    console.log(`   状态：轻度违约者`);
    console.log(`   违约分：7分 (无故缺席1次 + 迟到取消1次)`);
    console.log(`   预约权限：✅ 可以继续预约\n`);

    console.log(`3️⃣  ${testUsers[2].name} (ID: ${userId3})`);
    console.log(`   状态：重度违约者（黑名单）`);
    console.log(`   违约分：13分 (无故缺席2次 + 超时未签出1次)`);
    console.log(`   预约权限：❌ 已被限制，7天后解除\n`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("🧪 测试场景：");
    console.log("1. 使用快速登录按钮以这些用户身份登录");
    console.log("2. 查看 /admin/violations 页面可看到所有违约记录");
    console.log("3. 查看 /admin/audit-logs 页面可看到所有操作日志");
    console.log("4. 尝试用违约用户创建预约 → 应被黑名单限制\n");

    connection.release();
  } catch (error) {
    console.error("❌ 创建失败:", error);
    process.exit(1);
  }

  await pool.end();
}

createViolationUsers();
