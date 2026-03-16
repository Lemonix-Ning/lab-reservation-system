import { randomBytes } from 'crypto';

console.log('🔐 生成部署密钥...\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 请将以下密钥保存到 .env 文件中');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const dbRootPassword = randomBytes(15).toString('base64');
const dbPassword = randomBytes(15).toString('base64');
const jwtSecret = randomBytes(48).toString('base64');

console.log('# 数据库密码');
console.log(`DB_ROOT_PASSWORD=${dbRootPassword}`);
console.log(`DB_PASSWORD=${dbPassword}\n`);

console.log('# JWT 密钥');
console.log(`JWT_SECRET=${jwtSecret}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ 密钥生成完成！');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📋 下一步：');
console.log('1. 复制上面的密钥');
console.log('2. 在服务器上编辑 .env 文件');
console.log('3. 粘贴这些密钥到对应位置\n');
