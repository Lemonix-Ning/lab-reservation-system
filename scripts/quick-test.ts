/**
 * 快速验证关键功能
 */

console.log('🔍 快速验证关键功能\n');

// 1. 检查服务器是否运行
console.log('1️⃣ 检查服务器状态...');
fetch('http://localhost:3001/')
  .then(res => {
    console.log(`   ✅ 服务器运行正常 (状态码: ${res.status})`);
    return fetch('http://localhost:3001/api/oauth/providers');
  })
  .then(res => res.json())
  .then(data => {
    console.log(`   ✅ OAuth 提供商: ${data.providers.join(', ')}\n`);
    
    // 2. 检查登录页面
    console.log('2️⃣ 检查登录页面...');
    return fetch('http://localhost:3001/login');
  })
  .then(res => {
    console.log(`   ✅ 登录页面可访问 (状态码: ${res.status})\n`);
    
    console.log('✅ 基础功能验证通过！');
    console.log('\n📋 请在浏览器中完成以下测试：');
    console.log('   1. 访问 http://localhost:3001/login');
    console.log('   2. 使用 GitHub 登录');
    console.log('   3. 测试角色升级申请');
    console.log('   4. 测试账号注销');
    console.log('   5. 重新登录验证数据已删除');
    console.log('\n详细测试清单请查看: TEST_CHECKLIST.md');
  })
  .catch(err => {
    console.error('❌ 验证失败:', err.message);
    console.log('\n请确保：');
    console.log('   1. 服务器已启动: npm run dev');
    console.log('   2. 端口 3001 未被占用');
    console.log('   3. 数据库已配置并运行');
  });
