/**
 * 部署前检查脚本
 * 验证项目是否准备好部署到生产环境
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, fn: () => boolean, successMsg: string, failMsg: string) {
  try {
    const passed = fn();
    results.push({ name, passed, message: passed ? successMsg : failMsg });
  } catch (error: any) {
    results.push({ name, passed: false, message: `${failMsg}: ${error.message}` });
  }
}

console.log('🔍 开始部署前检查...\n');

// 1. 检查 Git 状态
check(
  'Git 状态',
  () => {
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf-8' });
      return status.trim().length === 0;
    } catch {
      return false;
    }
  },
  '✅ 所有更改已提交',
  '❌ 有未提交的更改'
);

// 2. 检查 package.json
check(
  'package.json',
  () => existsSync('package.json'),
  '✅ package.json 存在',
  '❌ package.json 不存在'
);

// 3. 检查 Dockerfile
check(
  'Dockerfile',
  () => existsSync('Dockerfile'),
  '✅ Dockerfile 存在',
  '❌ Dockerfile 不存在'
);

// 4. 检查 docker-compose.yml
check(
  'docker-compose.yml',
  () => existsSync('docker-compose.yml'),
  '✅ docker-compose.yml 存在',
  '❌ docker-compose.yml 不存在'
);

// 5. 检查 .env.example
check(
  '.env.example',
  () => existsSync('.env.example'),
  '✅ .env.example 存在',
  '❌ .env.example 不存在'
);

// 6. 检查 init-ssl.sh
check(
  'init-ssl.sh',
  () => {
    if (!existsSync('init-ssl.sh')) return false;
    const content = readFileSync('init-ssl.sh', 'utf-8');
    return content.includes('EMAIL=') && !content.includes('EMAIL=""');
  },
  '✅ init-ssl.sh 已配置邮箱',
  '❌ init-ssl.sh 未配置邮箱'
);

// 7. 检查 nginx 配置
check(
  'Nginx 配置',
  () => existsSync('nginx/conf.d/app.conf') && existsSync('nginx/conf.d/app.ssl.conf.template'),
  '✅ Nginx 配置文件存在',
  '❌ Nginx 配置文件缺失'
);

// 8. 检查 TypeScript 编译
check(
  'TypeScript 检查',
  () => {
    try {
      execSync('pnpm check', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  },
  '✅ TypeScript 类型检查通过',
  '❌ TypeScript 类型检查失败'
);

// 9. 检查测试
check(
  '单元测试',
  () => {
    try {
      execSync('pnpm test', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  },
  '✅ 所有测试通过',
  '❌ 测试失败'
);

// 10. 检查构建
check(
  '生产构建',
  () => {
    try {
      execSync('pnpm build', { stdio: 'pipe' });
      return existsSync('dist');
    } catch {
      return false;
    }
  },
  '✅ 生产构建成功',
  '❌ 生产构建失败'
);

// 输出结果
console.log('\n📊 检查结果:\n');
let allPassed = true;

results.forEach(result => {
  console.log(`${result.passed ? '✅' : '❌'} ${result.name}: ${result.message}`);
  if (!result.passed) allPassed = false;
});

console.log('\n' + '='.repeat(60));

if (allPassed) {
  console.log('✅ 所有检查通过！项目已准备好部署。\n');
  console.log('📝 下一步：');
  console.log('   1. 确保服务器已安装 Docker');
  console.log('   2. 配置 .env 文件');
  console.log('   3. 执行 ./init-ssl.sh\n');
  process.exit(0);
} else {
  console.log('❌ 部分检查未通过，请修复后再部署。\n');
  process.exit(1);
}
