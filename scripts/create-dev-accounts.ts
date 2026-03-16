/**
 * 创建开发测试账号
 * 这4个账号可以使用角色快速切换面板
 */

import * as db from '../server/db';

const devAccounts = [
  {
    openId: 'sysadmin-001',
    name: '系统管理员（测试）',
    email: 'sysadmin@example.com',
    role: 'sysAdmin' as const,
  },
  {
    openId: 'labadmin-001',
    name: '实验室管理员（测试）',
    email: 'labadmin@example.com',
    role: 'labAdmin' as const,
  },
  {
    openId: 'teacher-001',
    name: '教师（测试）',
    email: 'teacher@example.com',
    role: 'teacher' as const,
  },
  {
    openId: 'student-001',
    name: '学生（测试）',
    email: 'student@example.com',
    role: 'student' as const,
  },
];

async function createDevAccounts() {
  console.log('🔧 创建开发测试账号\n');

  try {
    for (const account of devAccounts) {
      console.log(`创建账号: ${account.name} (${account.role})`);
      
      await db.upsertUser({
        openId: account.openId,
        name: account.name,
        email: account.email,
        role: account.role,
        lastSignedIn: new Date(),
      });
      
      console.log(`  ✅ ${account.openId} 创建成功`);
    }

    console.log('\n✅ 所有测试账号创建完成！\n');
    console.log('📋 使用方法：');
    console.log('  1. 这4个账号登录后可以看到"角色切换面板"');
    console.log('  2. 点击不同角色按钮即可切换身份');
    console.log('  3. 无需重新登录，立即生效');
    console.log('  4. 点击"恢复真实角色"返回原始角色\n');
    
    console.log('🔐 测试账号列表：');
    devAccounts.forEach(acc => {
      console.log(`  - ${acc.name}: openId=${acc.openId}, role=${acc.role}`);
    });

  } catch (error) {
    console.error('❌ 创建失败:', error);
    throw error;
  }

  process.exit(0);
}

createDevAccounts();
