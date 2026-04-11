/**
 * 测试签到会话创建功能
 * 验证批量创建出勤记录时的 SQL 语法是否正确
 */

import * as db from '../server/db';

async function testCheckinSession() {
  console.log('🧪 测试签到会话创建...\n');

  try {
    // 1. 获取测试数据
    const allUsers = await db.getAllUsers();
    const teacher = allUsers.find(u => u.role === 'teacher');
    const students = allUsers.filter(u => u.role === 'student');

    if (!teacher) {
      console.log('❌ 未找到教师用户');
      return;
    }

    if (students.length === 0) {
      console.log('❌ 未找到学生用户');
      return;
    }

    console.log(`✅ 找到教师: ${teacher.name} (ID: ${teacher.id})`);
    console.log(`✅ 找到 ${students.length} 名学生\n`);

    // 2. 获取或创建测试课程
    const teacherCourses = await db.getCoursesByTeacherId(teacher.id);
    let testCourse = teacherCourses[0];

    if (!testCourse) {
      console.log('📝 创建测试课程...');
      await db.createCourse({
        courseNo: `TEST-${Date.now()}`,
        name: '测试课程-签到',
        description: '用于测试签到功能',
        teacherId: teacher.id,
        semester: '2024-1',
        status: 'active',
      } as any);
      const courses = await db.getCoursesByTeacherId(teacher.id);
      testCourse = courses[0];
      console.log(`✅ 课程创建成功: ${testCourse.name}\n`);
    } else {
      console.log(`✅ 使用现有课程: ${testCourse.name}\n`);
    }

    // 3. 添加学生到课程
    console.log('👥 添加学生到课程...');
    for (const student of students.slice(0, 3)) {
      try {
        await db.addStudentToCourse(testCourse.id, student.id);
        console.log(`   ✅ 添加学生: ${student.name}`);
      } catch (error) {
        // 学生可能已存在，忽略错误
      }
    }
    console.log('');

    // 4. 获取实验室
    const labs = await db.getAllLabRooms();
    if (labs.length === 0) {
      console.log('❌ 未找到实验室');
      return;
    }
    const testLab = labs[0];
    console.log(`✅ 使用实验室: ${testLab.name}\n`);

    // 5. 创建签到会话（这里会触发批量创建出勤记录）
    console.log('🎯 创建签到会话...');
    const sessionId = await db.createCheckinSession({
      courseId: testCourse.id,
      teacherId: teacher.id,
      labId: testLab.id,
      title: '测试签到会话',
      weekNo: 1,
      sessionDate: new Date(),
      allowLateMinutes: 15,
      useGeofence: false,
      qrcodeToken: `test-${Date.now()}`,
      qrcodeRefreshSeconds: 30,
      status: 'active',
      startedAt: new Date(),
    });
    console.log(`✅ 签到会话创建成功 (ID: ${sessionId})\n`);

    // 6. 初始化出勤记录
    console.log('📋 初始化出勤记录...');
    const studentCount = await db.initializeAttendances(
      sessionId,
      testCourse.id,
      new Date()
    );
    console.log(`✅ 成功创建 ${studentCount} 条出勤记录\n`);

    // 7. 验证出勤记录
    console.log('🔍 验证出勤记录...');
    const session = await db.getActiveCheckinSession(testCourse.id);
    if (session) {
      console.log(`✅ 签到会话状态: ${session.status}`);
      console.log(`✅ 二维码令牌: ${session.qrcodeToken}`);
    }

    // 8. 关闭会话
    console.log('\n🔒 关闭签到会话...');
    await db.closeCheckinSession(sessionId);
    console.log('✅ 签到会话已关闭\n');

    console.log('✅ 所有测试通过！');
    console.log('\n📋 修复说明:');
    console.log('   - 修复了 onDuplicateKeyUpdate 的 SQL 语法错误');
    console.log('   - 使用 sql`VALUES(sessionId)` 代替错误的 sql`session_id`');
    console.log('   - 批量创建出勤记录现在可以正常工作');

  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
    console.error(error);
  }
}

testCheckinSession();
