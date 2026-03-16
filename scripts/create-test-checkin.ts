/**
 * 创建测试签到预约脚本
 * 
 * 功能：直接在数据库中创建一条已审批通过的预约，时间设置为当前可签到窗口内
 * 用于测试签到/签退功能，绕过提前7天预约的限制
 * 
 * 用法：npx tsx scripts/create-test-checkin.ts [userId] [labId]
 *   userId: 可选，默认为 1
 *   labId: 可选，默认为 1
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  const userId = parseInt(process.argv[2] || '1', 10);
  const labId = parseInt(process.argv[3] || '1', 10);

  const connection = await mysql.createConnection(dbUrl);

  try {
    // 1. 验证用户和实验室存在
    const [users] = await connection.query<any[]>('SELECT id, name FROM users WHERE id = ?', [userId]);
    if (!users || users.length === 0) {
      console.error(`❌ 用户 ID ${userId} 不存在`);
      // 列出可用用户
      const [allUsers] = await connection.query<any[]>('SELECT id, name, role FROM users LIMIT 10');
      console.log('📋 可用用户列表：');
      allUsers.forEach((u: any) => console.log(`   ID: ${u.id}, 姓名: ${u.name}, 角色: ${u.role}`));
      process.exit(1);
    }

    const [labs] = await connection.query<any[]>('SELECT id, name FROM lab_rooms WHERE id = ?', [labId]);
    if (!labs || labs.length === 0) {
      console.error(`❌ 实验室 ID ${labId} 不存在`);
      // 列出可用实验室
      const [allLabs] = await connection.query<any[]>('SELECT id, name FROM lab_rooms LIMIT 10');
      console.log('📋 可用实验室列表：');
      allLabs.forEach((l: any) => console.log(`   ID: ${l.id}, 名称: ${l.name}`));
      process.exit(1);
    }

    const userName = users[0].name;
    const labName = labs[0].name;

    // 2. 创建一个当前时间可签到的预约
    // 签到窗口：开始前15分钟到结束时间
    // 注意：MySQL timestamp 存储的是 UTC 时间，需要用 UTC 时间插入
    const now = new Date();
    // 使用 UTC 时间：开始时间 = 当前UTC时间 - 30分钟，结束时间 = 当前UTC时间 + 3小时
    const startTime = new Date(now.getTime() - 30 * 60 * 1000); // 30分钟前
    const endTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3小时后
    
    // 格式化为 MySQL 可接受的 UTC 格式
    const formatUTC = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

    const title = `[测试签到] ${userName} - ${now.toLocaleString('zh-CN')}`;

    const [result] = await connection.query<any>(
      `INSERT INTO lab_reservations 
        (labId, userId, title, reason, peopleCount, startTime, endTime, status, applyTime, approveTime)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', NOW(), NOW())`,
      [labId, userId, title, '测试签到功能', 1, formatUTC(startTime), formatUTC(endTime)]
    );

    const reservationId = result.insertId;

    console.log('✅ 测试预约创建成功！');
    console.log('');
    console.log('📋 预约详情：');
    console.log(`   预约 ID: ${reservationId}`);
    console.log(`   用户: ${userName} (ID: ${userId})`);
    console.log(`   实验室: ${labName} (ID: ${labId})`);
    console.log(`   状态: approved (已审批)`);
    console.log(`   开始时间: ${startTime.toLocaleString('zh-CN')}`);
    console.log(`   结束时间: ${endTime.toLocaleString('zh-CN')}`);
    console.log('');
    console.log('🎯 现在可以测试签到功能了！');
    console.log('   1. 登录系统（使用对应用户）');
    console.log('   2. 进入"我的预约"页面');
    console.log('   3. 点击"签到"按钮');
    console.log('   4. 签到成功后点击"签退"按钮');

  } catch (err) {
    console.error('❌ 执行失败:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
