import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { labReservations, labRooms, labReserveRules, users } from "../drizzle/schema.js";

const pool = await mysql.createPool(process.env.DATABASE_URL ?? "");
const db = drizzle(pool);

async function seed() {
  console.log("开始初始化数据...");

  await db.delete(labReservations);
  await db.delete(labRooms);
  await db.delete(labReserveRules);

  await db.insert(users).values({
    openId: process.env.OWNER_OPEN_ID ?? "qq-admin-openid",
    name: "系统管理员",
    email: "admin@example.com",
    role: "admin",
    loginMethod: "mock",
  }).onDuplicateKeyUpdate({ set: { role: "admin" } });

  // 插入示例实验室
  const rooms = [
    {
      roomNo: "LAB-101",
      name: "计算机实验室A",
      building: "信息楼",
      location: "信息楼3楼305",
      capacity: 50,
      type: "机房",
      openTimeStart: "08:00",
      openTimeEnd: "22:00",
      status: "enabled",
      remark: "配备高性能计算机50台"
    },
    {
      roomNo: "LAB-102",
      name: "计算机实验室B",
      building: "信息楼",
      location: "信息楼3楼306",
      capacity: 40,
      type: "机房",
      openTimeStart: "08:00",
      openTimeEnd: "22:00",
      status: "enabled",
      remark: "配备计算机40台"
    },
    {
      roomNo: "LAB-201",
      name: "物理实验室",
      building: "理学楼",
      location: "理学楼2楼201",
      capacity: 30,
      type: "物理实验室",
      openTimeStart: "08:00",
      openTimeEnd: "18:00",
      status: "enabled",
      remark: "配备基础物理实验设备"
    },
    {
      roomNo: "LAB-301",
      name: "化学实验室",
      building: "理学楼",
      location: "理学楼4楼401",
      capacity: 25,
      type: "化学实验室",
      openTimeStart: "08:00",
      openTimeEnd: "18:00",
      status: "enabled",
      remark: "配备化学实验设备及通风系统"
    }
  ];

  for (const room of rooms) {
    await db.insert(labRooms).values(room);
  }
  console.log(`已插入 ${rooms.length} 个实验室`);

  // 插入预约规则
  const rules = [
    {
      ruleCode: "MAX_PER_DAY",
      ruleName: "每日最大预约次数",
      ruleValue: "2",
      description: "每位学生每日最多可预约2次",
      status: "enabled"
    },
    {
      ruleCode: "MAX_DURATION",
      ruleName: "单次预约最长时长",
      ruleValue: "4",
      description: "单次预约最长4小时",
      status: "enabled"
    },
    {
      ruleCode: "ADVANCE_DAYS",
      ruleName: "提前预约天数",
      ruleValue: "1",
      description: "必须提前至少1天预约",
      status: "enabled"
    }
  ];

  for (const rule of rules) {
    await db.insert(labReserveRules).values(rule);
  }
  console.log(`已插入 ${rules.length} 条预约规则`);

  console.log("数据初始化完成！");
  await pool.end();
}

seed().catch((error) => {
  console.error("数据初始化失败:", error);
  process.exit(1);
});
