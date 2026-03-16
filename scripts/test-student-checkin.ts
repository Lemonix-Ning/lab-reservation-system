/**
 * 测试学生签到功能
 * 验证学生能否看到教师开启的签到会话
 */

import * as db from '../server/db';

async function testStudentCheckin() {
  console.log('🧪 测试学生签到功能...\n');

  try {
    // 1. 获取测试用户
    const allUsers = await db.getAllUsers();
    const teacher = allUsers.find(u => u.role === 'teacher');
    const student = allUsers.find(u => u.role === 'student');

    if (!teacher || !student) {
      console.log('❌ 未找到教师或学生用户');
      return;
    }

    console.log(`✅ 教师: ${teacher.name} (ID: ${teacher.id})`);
    console.log(`✅ 学生: ${student.name} (ID: ${student.id})\n`);

    // 2. 获取或创建课程
    let teacherCourses = await db.getCoursesByTeacherId(teacher.id);
    let testCourse = teacherCourses[0];

    if (!testCourse) {
      console.log('📝 创建测试课程...');
      await db.createCourse({
        courseNo: `TEST-${Date.now()}`,
        name: '测试课程-学生签到',
        teacherId: teacher.id,
        semester: '2024-1',
        status: 'active',
      } as any);
      teacherCourses = await db.getCoursesByTeacherId(teacher.id);
      testCourse = teacherCourses[0];
    }
    console.log(`✅ 课程: ${testCourse.name} (ID: ${testCourse.id})\n`);

    // 3. 确保学生已加入课程
    console.log('👥 添加学生到课程...');
    try {
      await db.addStudentToCourse(testCourse.id, student.id);
      console.log('✅ 学生已加入课程\n');
    } catch (error) {
      console.log('✅ 学生已在课程中\n');
    }

    // 4. 验证学生的选课状态
    console.log('🔍 验证学生选课状态...');
    const studentCourses = await db.getStudentCourses(student.id);
    const isEnrolled = studentCourses.some(c => c.id === testCourse.id);
    console.log(`   学生选课数量: ${studentCourses.length}`);
    console.log(`   是否选了测试课程: ${isEnrolled ? '是' : '否'}\n`);

    if (!isEnrolled) {
      console.log('❌ 学生未选该课程，无法继续测试');
      return;
    }

    // 5. 获取实验室
    const labs = await db.getAllLabRooms();
    if (labs.length === 0) {
      console.log('❌ 未找到实验室');
      return;
    }
    const testLab = labs[0];

    // 6. 检查是否已有活跃会话
    let activeSession = await db.getActiveCheckinSession(testCourse.id);
    
    if (!activeSession) {
      console.log('🎯 创建签到会话...');
      const sessionId = await db.createCheckinSession({
        courseId: testCourse.id,
        teacherId: teacher.id,
        labId: testLab.id,
        title: '测试签到',
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

      // 初始化出勤记录
      await db.initializeAttendances(sessionId, testCourse.id, new Date());
      console.log('✅ 出勤记录已初始化\n');

      activeSession = await db.getActiveCheckinSession(testCourse.id);
    } else {
      console.log(`✅ 已有活跃签到会话 (ID: ${activeSession.id})\n`);
    }

    // 7. 测试学生查询活跃签到
    console.log('🔍 学生查询可签到的课程...');
    const activeCheckins = await db.getStudentActiveCheckins(student.id);
    
    console.log(`   查询结果数量: ${activeCheckins.length}`);
    
    if (activeCheckins.length === 0) {
      console.log('❌ 学生看不到活跃的签到会话！\n');
      console.log('📋 调试信息:');
      console.log(`   - 课程ID: ${testCourse.id}`);
      console.log(`   - 学生ID: ${student.id}`);
      console.log(`   - 会话状态: ${activeSession?.status}`);
      console.log(`   - 学生是否选课: ${isEnrolled}`);
    } else {
      console.log('✅ 学生可以看到签到会话！\n');
      activeCheckins.forEach((checkin: any) => {
        console.log(`   📝 ${checkin.courseName}`);
        console.log(`      实验室: ${checkin.labName}`);
        console.log(`      主题: ${checkin.title || '-'}`);
        console.log(`      已签到: ${checkin.hasCheckedIn ? '是' : '否'}`);
      });
    }

    console.log('\n✅ 测试完成！');

  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
    console.error(error);
  }
}

testStudentCheckin();
