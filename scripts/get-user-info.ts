import "dotenv/config";
import mysql from "mysql2/promise";

const pool = await mysql.createPool(process.env.DATABASE_URL ?? "");

const [rows] = await pool.query(`
  SELECT id, name, email, openId, role 
  FROM users 
  WHERE name LIKE '%李%' 
  LIMIT 1
`);

const user = (rows as any)[0];
if (user) {
  console.log('\n=== 李同学登录信息 ===');
  console.log(`用户ID: ${user.id}`);
  console.log(`姓名: ${user.name}`);
  console.log(`邮箱: ${user.email}`);
  console.log(`OpenID: ${user.openId}`);
  console.log(`角色: ${user.role}`);
  console.log('\n模拟登录地址:');
  console.log(`http://localhost:4000/oauth/authorize?openid=${encodeURIComponent(user.openId)}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&role=${user.role}`);
  console.log('\n注意：此用户在黑名单中，创建预约将被拒绝！\n');
} else {
  console.log('未找到李同学');
}

await pool.end();
