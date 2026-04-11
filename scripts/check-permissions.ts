import mysql from 'mysql2/promise';
import 'dotenv/config';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await conn.execute('SELECT * FROM role_permissions ORDER BY role, permissionCode');
  console.log('Current permissions in DB:');
  console.table(rows);
  await conn.end();
}

main().catch(console.error);
