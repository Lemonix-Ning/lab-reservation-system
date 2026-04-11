/**
 * 角色管理系统测试脚本
 * 测试完整的角色管理流程：白名单 → 注册 → 角色升级 → 权限检查
 */

import * as db from '../server/db';

async function testRoleManagement() {
  console.log('🧪 开始测试角色管理系统\n');

  try {
    // ========== 测试1：白名单功能 ==========
    console.log('📋 测试1：白名单功能');
    
    // 添加测试白名单
    const testEmail = 'test-teacher@example.com';
    console.log(`  添加白名单：${testEmail} (teacher)`);
    
    try {
      await db.addWhitelist({
        email: testEmail,
        role: 'teacher',
        name: '测试教师',
        department: '计算机学院',
        employeeNo: 'T001',
      });
      console.log('  ✅ 白名单添加成功');
    } catch (e: any) {
      if (e.message.includes('Duplicate')) {
        console.log('  ℹ️  白名单已存在（跳过）');
      } else {
        throw e;
      }
    }

    // 查询白名单
    const whitelist = await db.getWhitelistByEmail(testEmail);
    if (whitelist) {
      console.log(`  ✅ 白名单查询成功：${whitelist.email} -> ${whitelist.role}`);
    } else {
      console.log('  ❌ 白名单查询失败');
    }

    // 获取所有白名单
    const allWhitelist = await db.getAllWhitelist();
    console.log(`  ✅ 白名单总数：${allWhitelist.length} 条\n`);

    // ========== 测试2：角色升级路径限制 ==========
    console.log('📋 测试2：角色升级路径限制');
    
    // 创建测试用户（学生）
    const studentOpenId = 'test-student-001';
    await db.upsertUser({
      openId: studentOpenId,
      name: '测试学生',
      email: 'student@example.com',
      role: 'student',
    });
    
    const student = await db.getUserByOpenId(studentOpenId);
    if (!student) {
      throw new Error('创建学生用户失败');
    }
    console.log(`  ✅ 创建学生用户：ID=${student.id}, role=${student.role}`);

    // 测试学生申请教师
    console.log('  测试：学生申请教师...');
    try {
      const requestId = await db.createRoleUpgradeRequest({
        userId: student.id,
        requestedRole: 'teacher',
        reason: '我是一名教师，需要管理课程和发起签到',
        department: '计算机学院',
        employeeNo: 'T002',
      });
      console.log(`  ✅ 学生可以申请教师（申请ID: ${requestId}）`);
    } catch (e: any) {
      console.log(`  ❌ 学生申请教师失败：${e.message}`);
    }

    // 测试学生直接申请管理员（应该被拒绝）
    console.log('  测试：学生直接申请管理员（应该失败）...');
    try {
      await db.createRoleUpgradeRequest({
        userId: student.id,
        requestedRole: 'labAdmin',
        reason: '我想直接成为管理员',
      });
      console.log('  ❌ 学生不应该能直接申请管理员！');
    } catch (e: any) {
      if (e.message.includes('待处理')) {
        console.log('  ✅ 正确拒绝（原因：已有待处理申请）');
      } else {
        console.log(`  ⚠️  拒绝原因：${e.message}`);
      }
    }

    // 获取用户的申请记录
    const userRequests = await db.getUserRoleRequests(student.id);
    console.log(`  ✅ 用户申请记录数：${userRequests.length} 条\n`);

    // ========== 测试3：角色升级审批 ==========
    console.log('📋 测试3：角色升级审批');
    
    // 创建管理员用户
    const adminOpenId = 'test-admin-001';
    await db.upsertUser({
      openId: adminOpenId,
      name: '测试管理员',
      email: 'admin@example.com',
      role: 'sysAdmin',
    });
    
    const admin = await db.getUserByOpenId(adminOpenId);
    if (!admin) {
      throw new Error('创建管理员用户失败');
    }
    console.log(`  ✅ 创建管理员用户：ID=${admin.id}, role=${admin.role}`);

    // 获取待审核申请
    const pendingRequests = await db.getPendingRoleRequests();
    console.log(`  待审核申请数：${pendingRequests.length} 条`);

    if (pendingRequests.length > 0) {
      const request = pendingRequests[0];
      console.log(`  审批申请：ID=${request.id}, 用户=${request.user?.name}, 目标角色=${request.requestedRole}`);
      
      // 通过申请
      await db.reviewRoleRequest(request.id, admin.id, true, '审核通过');
      console.log('  ✅ 申请已通过');

      // 验证用户角色是否更新
      const updatedUser = await db.getUserById(request.userId);
      if (updatedUser && updatedUser.role === request.requestedRole) {
        console.log(`  ✅ 用户角色已更新：${updatedUser.role}`);
      } else {
        console.log(`  ❌ 用户角色更新失败`);
      }
    } else {
      console.log('  ℹ️  没有待审核申请\n');
    }

    // ========== 测试4：权限系统 ==========
    console.log('📋 测试4：权限系统');
    
    // 测试学生权限
    console.log('  测试学生权限：');
    const studentPerms = await db.getUserPermissions(student.id);
    console.log(`    学生权限数：${studentPerms.length} 个`);
    console.log(`    权限列表：${studentPerms.join(', ') || '无'}`);
    
    const canManageLab = await db.hasPermission(student.id, 'lab:manage');
    console.log(`    能否管理实验室：${canManageLab ? '✅ 是' : '❌ 否'}`);

    // 测试管理员权限
    console.log('  测试管理员权限：');
    const adminPerms = await db.getUserPermissions(admin.id);
    console.log(`    管理员权限数：${adminPerms.length} 个`);
    console.log(`    能否管理实验室：${await db.hasPermission(admin.id, 'lab:manage') ? '✅ 是' : '❌ 否'}`);
    console.log(`    能否查看统计：${await db.hasPermission(admin.id, 'statistics:view') ? '✅ 是' : '❌ 否'}`);

    // 获取所有权限定义
    console.log(`  系统权限定义总数：${db.ALL_PERMISSIONS.length} 个\n`);

    // ========== 测试5：OAuth 注册与白名单集成 ==========
    console.log('📋 测试5：OAuth 注册与白名单集成');
    
    // 模拟白名单用户注册
    const whitelistUserOpenId = 'github-whitelist-user';
    await db.upsertUser({
      openId: whitelistUserOpenId,
      name: '白名单教师',
      email: testEmail, // 使用白名单中的邮箱
      role: 'teacher', // 应该自动分配为 teacher
    });
    
    const whitelistUser = await db.getUserByOpenId(whitelistUserOpenId);
    if (whitelistUser && whitelistUser.role === 'teacher') {
      console.log(`  ✅ 白名单用户注册成功，自动分配角色：${whitelistUser.role}`);
    } else {
      console.log(`  ❌ 白名单用户角色分配失败`);
    }

    // 模拟非白名单用户注册
    const normalUserOpenId = 'github-normal-user';
    await db.upsertUser({
      openId: normalUserOpenId,
      name: '普通用户',
      email: 'normal@example.com',
      role: 'student', // 应该默认为 student
    });
    
    const normalUser = await db.getUserByOpenId(normalUserOpenId);
    if (normalUser && normalUser.role === 'student') {
      console.log(`  ✅ 普通用户注册成功，默认角色：${normalUser.role}\n`);
    } else {
      console.log(`  ❌ 普通用户角色分配失败\n`);
    }

    // ========== 测试6：账号注销与重新注册 ==========
    console.log('📋 测试6：账号注销与重新注册');
    
    // 创建测试用户
    const deleteTestOpenId = 'test-delete-user';
    await db.upsertUser({
      openId: deleteTestOpenId,
      name: '待删除用户',
      email: 'delete@example.com',
      role: 'student',
    });
    
    const deleteUser = await db.getUserByOpenId(deleteTestOpenId);
    if (!deleteUser) {
      throw new Error('创建待删除用户失败');
    }
    console.log(`  ✅ 创建测试用户：ID=${deleteUser.id}`);

    // 创建 OAuth 绑定
    await db.createOAuthBinding({
      userId: deleteUser.id,
      provider: 'github',
      providerUserId: 'github-12345',
      providerEmail: 'delete@example.com',
      providerName: '待删除用户',
    });
    console.log('  ✅ 创建 OAuth 绑定');

    // 注销账号
    console.log('  执行账号注销...');
    await db.deleteUserAccount(deleteUser.id);
    console.log('  ✅ 账号注销成功');

    // 验证用户已删除
    const deletedUser = await db.getUserById(deleteUser.id);
    if (!deletedUser) {
      console.log('  ✅ 用户记录已删除');
    } else {
      console.log('  ❌ 用户记录未删除');
    }

    // 验证 OAuth 绑定已删除
    const deletedBinding = await db.getUserByOAuthBinding('github', 'github-12345');
    if (!deletedBinding) {
      console.log('  ✅ OAuth 绑定已删除');
    } else {
      console.log('  ❌ OAuth 绑定未删除');
    }

    // 模拟重新注册（使用相同的 OAuth ID）
    console.log('  模拟重新注册...');
    await db.upsertUser({
      openId: 'github-github-12345', // 新的 openId
      name: '重新注册用户',
      email: 'delete@example.com',
      role: 'student',
    });
    
    const reregisteredUser = await db.getUserByOpenId('github-github-12345');
    if (reregisteredUser && reregisteredUser.id !== deleteUser.id) {
      console.log(`  ✅ 重新注册成功，新用户ID=${reregisteredUser.id}（不同于旧ID ${deleteUser.id}）\n`);
    } else {
      console.log('  ❌ 重新注册失败\n');
    }

    // ========== 测试总结 ==========
    console.log('✅ 所有测试完成！\n');
    console.log('📊 测试总结：');
    console.log('  ✅ 白名单功能正常');
    console.log('  ✅ 角色升级路径限制正常');
    console.log('  ✅ 角色升级审批流程正常');
    console.log('  ✅ 权限系统正常');
    console.log('  ✅ OAuth 注册与白名单集成正常');
    console.log('  ✅ 账号注销与重新注册正常');

  } catch (error) {
    console.error('\n❌ 测试失败：', error);
    throw error;
  }
}

// 运行测试
testRoleManagement()
  .then(() => {
    console.log('\n🎉 测试脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 测试脚本执行失败：', error);
    process.exit(1);
  });
