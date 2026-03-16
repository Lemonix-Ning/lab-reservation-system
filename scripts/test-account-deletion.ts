/**
 * 测试账号注销功能
 * 验证注销后数据是否真的被删除
 */

import { config } from "dotenv";
config(); // 加载 .env 文件

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import * as schema from "../drizzle/schema";

async function testAccountDeletion() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL 未设置");
    return;
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection, { schema, mode: "default" });

  console.log("=== 账号注销功能测试 ===\n");

  // 1. 查询所有用户
  const users = await db.select().from(schema.users);
  console.log(`📊 当前用户数: ${users.length}`);
  users.forEach((user) => {
    console.log(`  - ID: ${user.id}, Name: ${user.name}, OpenID: ${user.openId}`);
  });

  if (users.length === 0) {
    console.log("\n✅ 没有用户，注销功能可能已生效");
    await connection.end();
    return;
  }

  // 2. 查询 OAuth 绑定
  const bindings = await db.select().from(schema.userOAuthBindings);
  console.log(`\n🔗 OAuth 绑定数: ${bindings.length}`);
  bindings.forEach((binding) => {
    console.log(
      `  - User ID: ${binding.userId}, Provider: ${binding.provider}, Status: ${binding.status}`
    );
  });

  // 3. 查询预约记录
  const reservations = await db.select().from(schema.labReservations);
  console.log(`\n📅 预约记录数: ${reservations.length}`);

  // 4. 查询通知
  const notifications = await db.select().from(schema.notifications);
  console.log(`🔔 通知数: ${notifications.length}`);

  // 5. 查询违约记录
  const violations = await db.select().from(schema.violationRecords);
  console.log(`⚠️  违约记录数: ${violations.length}`);

  // 6. 查询审计日志
  const auditLogs = await db.select().from(schema.auditLogs);
  console.log(`📝 审计日志数: ${auditLogs.length}`);
  
  // 查找账号删除的审计日志
  const deletionLogs = auditLogs.filter(
    (log) => log.operationType === "user_account_delete"
  );
  if (deletionLogs.length > 0) {
    console.log(`\n🗑️  发现 ${deletionLogs.length} 条账号删除记录:`);
    deletionLogs.forEach((log) => {
      console.log(`  - 时间: ${log.operatedAt}`);
      console.log(`  - 操作人: ${log.operatorUserId}`);
      console.log(`  - 详情: ${log.details}`);
    });
  }

  await connection.end();
}

testAccountDeletion().catch(console.error);
