/**
 * 角色管理逻辑测试（不需要数据库）
 * 测试角色升级路径的逻辑正确性
 */

// 模拟角色升级检查逻辑
function checkRoleUpgradePath(currentRole: string, requestedRole: string): { valid: boolean; message?: string } {
  // 系统管理员无需申请
  if (currentRole === 'sysAdmin') {
    return { valid: false, message: '系统管理员无需申请' };
  }

  // 已经是目标角色
  if (currentRole === requestedRole) {
    return { valid: false, message: '您已经是该角色' };
  }

  // 角色升级路径限制：student → teacher → labAdmin
  if (currentRole === 'student' && requestedRole === 'labAdmin') {
    return { valid: false, message: '学生需要先申请成为教师，才能申请实验室管理员' };
  }

  // 不允许降级
  if (currentRole === 'labAdmin' && requestedRole === 'teacher') {
    return { valid: false, message: '实验室管理员权限高于教师，无需降级' };
  }

  return { valid: true };
}

console.log('🧪 测试角色升级路径逻辑\n');

const testCases = [
  { current: 'student', requested: 'teacher', expected: true, desc: '学生申请教师' },
  { current: 'student', requested: 'labAdmin', expected: false, desc: '学生直接申请管理员（应拒绝）' },
  { current: 'teacher', requested: 'labAdmin', expected: true, desc: '教师申请管理员' },
  { current: 'teacher', requested: 'teacher', expected: false, desc: '教师申请教师（重复）' },
  { current: 'labAdmin', requested: 'teacher', expected: false, desc: '管理员降级为教师（应拒绝）' },
  { current: 'labAdmin', requested: 'labAdmin', expected: false, desc: '管理员申请管理员（重复）' },
  { current: 'sysAdmin', requested: 'teacher', expected: false, desc: '系统管理员申请（应拒绝）' },
];

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = checkRoleUpgradePath(test.current, test.requested);
  const success = result.valid === test.expected;
  
  if (success) {
    console.log(`✅ 测试 ${index + 1}: ${test.desc}`);
    if (result.message) {
      console.log(`   原因: ${result.message}`);
    }
    passed++;
  } else {
    console.log(`❌ 测试 ${index + 1}: ${test.desc}`);
    console.log(`   期望: ${test.expected ? '通过' : '拒绝'}`);
    console.log(`   实际: ${result.valid ? '通过' : '拒绝'}`);
    if (result.message) {
      console.log(`   原因: ${result.message}`);
    }
    failed++;
  }
});

console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);

if (failed === 0) {
  console.log('🎉 所有测试通过！角色升级路径逻辑正确。');
  process.exit(0);
} else {
  console.log('💥 有测试失败，请检查逻辑。');
  process.exit(1);
}
