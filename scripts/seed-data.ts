import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { users, labRooms, labReservations, labReserveRules, labDevices } from "../drizzle/schema";

const pool = await mysql.createPool(process.env.DATABASE_URL ?? "");
const db = drizzle(pool);

// 模拟管理员用户
const timestamp = Date.now();
const adminUsers = [
  {
    openId: `admin_seed_${timestamp}_001`,
    name: "种子管理员A",
    email: `admin_seed_a_${timestamp}@example.com`,
    loginMethod: "oauth",
    role: "admin" as const,
  },
  {
    openId: `admin_seed_${timestamp}_002`,
    name: "种子管理员B",
    email: `admin_seed_b_${timestamp}@example.com`,
    loginMethod: "oauth",
    role: "admin" as const,
  },
];

// 模拟普通用户
const regularUsers = [
  { openId: `user_seed_${timestamp}_001`, name: "王同学", email: `student_${timestamp}_1@example.com`, loginMethod: "oauth", role: "user" as const },
  { openId: `user_seed_${timestamp}_002`, name: "李同学", email: `student_${timestamp}_2@example.com`, loginMethod: "oauth", role: "user" as const },
  { openId: `user_seed_${timestamp}_003`, name: "赵同学", email: `student_${timestamp}_3@example.com`, loginMethod: "oauth", role: "user" as const },
  { openId: `user_seed_${timestamp}_004`, name: "陈同学", email: `student_${timestamp}_4@example.com`, loginMethod: "oauth", role: "user" as const },
  { openId: `user_seed_${timestamp}_005`, name: "刘同学", email: `student_${timestamp}_5@example.com`, loginMethod: "oauth", role: "user" as const },
  { openId: `user_seed_${timestamp}_006`, name: "杨同学", email: `student_${timestamp}_6@example.com`, loginMethod: "oauth", role: "user" as const },
  { openId: `user_seed_${timestamp}_007`, name: "黄同学", email: `student_${timestamp}_7@example.com`, loginMethod: "oauth", role: "user" as const },
  { openId: `user_seed_${timestamp}_008`, name: "周同学", email: `student_${timestamp}_8@example.com`, loginMethod: "oauth", role: "user" as const },
  { openId: `user_seed_${timestamp}_009`, name: "吴同学", email: `student_${timestamp}_9@example.com`, loginMethod: "oauth", role: "user" as const },
  { openId: `user_seed_${timestamp}_010`, name: "徐同学", email: `student_${timestamp}_10@example.com`, loginMethod: "oauth", role: "user" as const },
];

// 模拟实验室
const labs = [
  {
    roomNo: "A101",
    name: "计算机组成原理实验室",
    building: "A 栋",
    location: "一楼",
    capacity: 30,
    type: "计算机",
    managerId: 1,
    openTimeStart: "08:00",
    openTimeEnd: "22:00",
    status: "enabled" as const,
    remark: "用于计算机组成原理实验教学",
  },
  {
    roomNo: "A102",
    name: "数据结构实验室",
    building: "A 栋",
    location: "二楼",
    capacity: 40,
    type: "计算机",
    managerId: 1,
    openTimeStart: "08:00",
    openTimeEnd: "22:00",
    status: "enabled" as const,
    remark: "用于数据结构实验教学",
  },
  {
    roomNo: "B201",
    name: "数据库实验室",
    building: "B 栋",
    location: "二楼",
    capacity: 35,
    type: "计算机",
    managerId: 2,
    openTimeStart: "08:00",
    openTimeEnd: "22:00",
    status: "enabled" as const,
    remark: "用于数据库实验教学",
  },
  {
    roomNo: "B202",
    name: "网络实验室",
    building: "B 栋",
    location: "二楼",
    capacity: 25,
    type: "网络",
    managerId: 2,
    openTimeStart: "08:00",
    openTimeEnd: "22:00",
    status: "enabled" as const,
    remark: "用于网络实验教学",
  },
  {
    roomNo: "C301",
    name: "操作系统实验室",
    building: "C 栋",
    location: "三楼",
    capacity: 30,
    type: "计算机",
    managerId: 1,
    openTimeStart: "08:00",
    openTimeEnd: "22:00",
    status: "enabled" as const,
    remark: "用于操作系统实验教学",
  },
];

// 模拟设备
const devices = [
  {
    labId: 1,
    deviceNo: "PC001",
    name: "计算机1",
    type: "台式机",
    purchaseDate: new Date("2022-01-15"),
    status: "available" as const,
    description: "Intel i7-10代处理器",
  },
  {
    labId: 1,
    deviceNo: "PC002",
    name: "计算机2",
    type: "台式机",
    purchaseDate: new Date("2022-02-10"),
    status: "available" as const,
    description: "Intel i7-10代处理器",
  },
  {
    labId: 1,
    deviceNo: "PROJECTOR001",
    name: "投影仪",
    type: "投影仪",
    purchaseDate: new Date("2021-06-01"),
    status: "available" as const,
    description: "投影仪设备",
  },
  {
    labId: 2,
    deviceNo: "PC003",
    name: "计算机3",
    type: "台式机",
    purchaseDate: new Date("2022-03-15"),
    status: "available" as const,
    description: "Intel i5-11代处理器",
  },
  {
    labId: 2,
    deviceNo: "SERVER001",
    name: "服务器",
    type: "服务器",
    purchaseDate: new Date("2021-12-01"),
    status: "available" as const,
    description: "实验用服务器",
  },
  {
    labId: 3,
    deviceNo: "DB001",
    name: "数据库服务器",
    type: "服务器",
    purchaseDate: new Date("2022-01-01"),
    status: "available" as const,
    description: "MySQL数据库服务器",
  },
  {
    labId: 4,
    deviceNo: "SWITCH001",
    name: "网络交换机",
    type: "网络设备",
    purchaseDate: new Date("2021-09-01"),
    status: "available" as const,
    description: "48口网络交换机",
  },
  {
    labId: 5,
    deviceNo: "PC004",
    name: "计算机4",
    type: "台式机",
    purchaseDate: new Date("2022-04-10"),
    status: "maintenance" as const,
    description: "Intel i9-11代处理器",
  },
];

// 模拟预约记录
const reservations = [
  // 已批准的预约
  {
    labId: 1,
    userId: 3,
    title: "计算机组成原理实验",
    reason: "进行CPU设计实验",
    peopleCount: 25,
    startTime: new Date("2024-12-02 10:00:00"),
    endTime: new Date("2024-12-02 12:00:00"),
    status: "approved" as const,
    approveTime: new Date("2024-12-01 14:00:00"),
  },
  {
    labId: 2,
    userId: 4,
    title: "数据结构实验课",
    reason: "学习二叉树相关算法",
    peopleCount: 30,
    startTime: new Date("2024-12-03 14:00:00"),
    endTime: new Date("2024-12-03 16:00:00"),
    status: "approved" as const,
    approveTime: new Date("2024-12-01 15:00:00"),
  },
  {
    labId: 3,
    userId: 5,
    title: "数据库课程设计",
    reason: "完成数据库设计项目",
    peopleCount: 20,
    startTime: new Date("2024-12-04 09:00:00"),
    endTime: new Date("2024-12-04 11:00:00"),
    status: "approved" as const,
    approveTime: new Date("2024-12-01 16:00:00"),
  },
  
  // 待审核的预约
  {
    labId: 1,
    userId: 6,
    title: "算法设计实验",
    reason: "进行排序算法对比实验",
    peopleCount: 25,
    startTime: new Date("2024-12-05 10:00:00"),
    endTime: new Date("2024-12-05 12:00:00"),
    status: "pending" as const,
  },
  {
    labId: 2,
    userId: 7,
    title: "图论实验",
    reason: "学习图的遍历算法",
    peopleCount: 22,
    startTime: new Date("2024-12-06 14:00:00"),
    endTime: new Date("2024-12-06 16:00:00"),
    status: "pending" as const,
  },
  {
    labId: 4,
    userId: 8,
    title: "网络配置实验",
    reason: "进行网络拓扑设计",
    peopleCount: 15,
    startTime: new Date("2024-12-07 09:00:00"),
    endTime: new Date("2024-12-07 11:00:00"),
    status: "pending" as const,
  },
  
  // 已拒绝的预约
  {
    labId: 5,
    userId: 9,
    title: "操作系统实验",
    reason: "进行内存管理实验",
    peopleCount: 28,
    startTime: new Date("2024-11-28 10:00:00"),
    endTime: new Date("2024-11-28 12:00:00"),
    status: "rejected" as const,
    rejectReason: "该时间段实验室维护中",
  },
  
  // 更多已批准的预约（用于统计数据）
  {
    labId: 1,
    userId: 3,
    title: "CPU设计实验",
    reason: "学习CPU指令集",
    peopleCount: 20,
    startTime: new Date("2024-11-20 10:00:00"),
    endTime: new Date("2024-11-20 12:00:00"),
    status: "approved" as const,
    approveTime: new Date("2024-11-19 14:00:00"),
  },
  {
    labId: 2,
    userId: 4,
    title: "链表实验",
    reason: "学习链表操作",
    peopleCount: 25,
    startTime: new Date("2024-11-21 14:00:00"),
    endTime: new Date("2024-11-21 16:00:00"),
    status: "approved" as const,
    approveTime: new Date("2024-11-20 15:00:00"),
  },
  {
    labId: 3,
    userId: 5,
    title: "SQL查询实验",
    reason: "学习复杂查询",
    peopleCount: 18,
    startTime: new Date("2024-11-22 09:00:00"),
    endTime: new Date("2024-11-22 11:00:00"),
    status: "approved" as const,
    approveTime: new Date("2024-11-21 16:00:00"),
  },
  {
    labId: 4,
    userId: 6,
    title: "TCP/IP实验",
    reason: "学习网络协议",
    peopleCount: 20,
    startTime: new Date("2024-11-23 10:00:00"),
    endTime: new Date("2024-11-23 12:00:00"),
    status: "approved" as const,
    approveTime: new Date("2024-11-22 14:00:00"),
  },
  {
    labId: 5,
    userId: 7,
    title: "进程管理实验",
    reason: "学习进程调度",
    peopleCount: 25,
    startTime: new Date("2024-11-24 14:00:00"),
    endTime: new Date("2024-11-24 16:00:00"),
    status: "approved" as const,
    approveTime: new Date("2024-11-23 15:00:00"),
  },
  
  // 已取消的预约
  {
    labId: 1,
    userId: 8,
    title: "缓存实验",
    reason: "学习缓存机制",
    peopleCount: 20,
    startTime: new Date("2024-11-25 10:00:00"),
    endTime: new Date("2024-11-25 12:00:00"),
    status: "cancelled" as const,
  },
];

// 模拟规则配置
const rules = [
  {
    ruleCode: "MAX_DURATION",
    ruleName: "单次预约最长时长",
    ruleValue: "4",
    description: "单次预约不能超过4小时",
    status: "enabled" as const,
  },
  {
    ruleCode: "MAX_PER_DAY",
    ruleName: "每天最多预约次数",
    ruleValue: "3",
    description: "每个用户每天最多预约3次",
    status: "enabled" as const,
  },
  {
    ruleCode: "ADVANCE_DAYS",
    ruleName: "提前预约天数",
    ruleValue: "14",
    description: "最多提前14天预约",
    status: "enabled" as const,
  },
  {
    ruleCode: "MIN_INTERVAL",
    ruleName: "预约间隔时间",
    ruleValue: "30",
    description: "两次预约之间最少间隔30分钟",
    status: "enabled" as const,
  },
  {
    ruleCode: "MIN_CAPACITY",
    ruleName: "最小容纳人数",
    ruleValue: "5",
    description: "预约人数不能少于5人",
    status: "enabled" as const,
  },
];

async function seedData() {
  console.log("🌱 开始初始化数据...\n");

  try {
    // 清空现有数据
    console.log("🗑️  清空现有数据...");
    await db.delete(labReservations);
    await db.delete(labDevices);
    await db.delete(labRooms);
    await db.delete(labReserveRules);
    await db.delete(users);
    
    // 重置 AUTO_INCREMENT
    console.log("🔄 重置自动增量...");
    const connection = await pool.getConnection();
    try {
      await connection.query('ALTER TABLE users AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE lab_rooms AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE lab_devices AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE lab_reservations AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE lab_reserve_rules AUTO_INCREMENT = 1');
    } finally {
      connection.release();
    }

    // 插入用户
    console.log("👥 插入管理员用户...");
    try {
      await db.insert(users).values(adminUsers);
      console.log(`✅ 插入 ${adminUsers.length} 个管理员用户`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") {
        console.log(`⚠️  管理员用户已存在，跳过插入`);
      } else {
        throw e;
      }
    }

    console.log("👥 插入普通用户...");
    try {
      await db.insert(users).values(regularUsers);
      console.log(`✅ 插入 ${regularUsers.length} 个普通用户`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") {
        console.log(`⚠️  普通用户已存在，跳过插入`);
      } else {
        throw e;
      }
    }

    // 插入实验室
    console.log("🏢 插入实验室...");
    try {
      await db.insert(labRooms).values(labs);
      console.log(`✅ 插入 ${labs.length} 个实验室`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") {
        console.log(`⚠️  实验室已存在，跳过插入`);
      } else {
        throw e;
      }
    }

    // 插入设备
    console.log("⚙️  插入设备...");
    try {
      await db.insert(labDevices).values(devices);
      console.log(`✅ 插入 ${devices.length} 个设备`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") {
        console.log(`⚠️  设备已存在，跳过插入`);
      } else {
        throw e;
      }
    }

    // 插入预约记录
    console.log("📅 插入预约记录...");
    try {
      await db.insert(labReservations).values(reservations);
      console.log(`✅ 插入 ${reservations.length} 条预约记录`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY" || e.code === "ER_NO_REFERENCED_ROW") {
        console.log(`⚠️  预约记录已存在或引用错误，跳过插入`);
      } else {
        throw e;
      }
    }

    // 插入规则
    console.log("⚖️  插入规则配置...");
    try {
      await db.insert(labReserveRules).values(rules);
      console.log(`✅ 插入 ${rules.length} 条规则配置`);
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") {
        console.log(`⚠️  规则配置已存在，跳过插入`);
      } else {
        throw e;
      }
    }

    console.log("\n✨ 数据初始化完成！");
    console.log("\n📊 数据统计:");
    console.log(`  - 用户: ${adminUsers.length + regularUsers.length}`);
    console.log(`  - 实验室: ${labs.length}`);
    console.log(`  - 设备: ${devices.length}`);
    console.log(`  - 预约: ${reservations.length}`);
    console.log(`  - 规则: ${rules.length}`);
  } catch (error) {
    console.error("❌ 初始化数据失败:", error);
    process.exit(1);
  }

  await pool.end();
}

seedData();
