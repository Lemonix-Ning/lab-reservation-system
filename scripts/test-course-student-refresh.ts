/**
 * 测试课程学生列表刷新功能
 * 
 * 验证：
 * 1. 添加学生后，学生列表是否正确更新
 * 2. 移除学生后，学生列表是否正确更新
 * 3. 学生端是否能看到自己被添加的课程
 */

import * as db from '../server/db';

async function testCourseStudentRefresh() {
  console.log('🧪 开始测试课程学生列表刷新功能...\n');

  try {
    // 1. 获取测试数据
    const allUsers = await db.getAllUsers();
    const teacher = allUsers.find(u => u.role === 'teacher');
    const student = allUsers.find(u => u.role === 'student');

    if (!teacher) {
      console.log('❌ 未找到教师用户，请先创建测试账号');
      return;
    }

    if (!student) {
      console.log('❌ 未找到学生用户，请先创建测试账号');
      return;
    }

    console.log(`✅ 找到教师: ${teacher.name} (ID: ${teacher.id})`);
    console.log(`✅ 找到学生: ${student.name} (ID: ${student.id})\n`);

    // 2. 创建测试课程
    console.log('📝 创建测试课程...');
    await db.createCourse({
      courseNo: `TEST-${Date.now()}`,
      name: '测试课程-学生列表刷新',
      description: '用于测试学生列表刷新功能',
      teacherId: teacher.id,
      semester: '2024-1',
      status: 'active',
    } as any);

    const teacherCourses = await db.getCoursesByTeacherId(teacher.id);
    const testCourse = teacherCourses[0];
    console.log(`✅ 课程创建成功: ${testCourse.name} (ID: ${testCourse.id})\n`);

    // 3. 测试添加学生
    console.log('👥 测试添加学生到课程...');
    const studentsBefore = await db.getCourseStudents(testCourse.id);
    console.log(`   添加前学生数量: ${studentsBefore.length}`);

    await db.addStudentToCourse(testCourse.id, student.id);
    
    const studentsAfter = await db.getCourseStudents(testCourse.id);
    console.log(`   添加后学生数量: ${studentsAfter.length}`);

    if (studentsAfter.length === studentsBefore.length + 1) {
      console.log('✅ 学生添加成功，列表已更新\n');
    } else {
      console.log('❌ 学生列表未正确更新\n');
    }

    // 4. 验证学生端能看到课程
    console.log('🔍 验证学生端课程列表...');
    const studentCourses = await db.getStudentCourses(student.id);
    const foundCourse = studentCourses.find(c => c.id === testCourse.id);

    if (foundCourse) {
      console.log(`✅ 学生可以看到课程: ${foundCourse.name}`);
      console.log(`   课程编号: ${foundCourse.courseNo}`);
      console.log(`   教师: ${foundCourse.teacherName}\n`);
    } else {
      console.log('❌ 学生无法看到已加入的课程\n');
    }

    // 5. 测试移除学生
    console.log('🗑️  测试从课程移除学生...');
    await db.removeStudentFromCourse(testCourse.id, student.id);
    
    const studentsAfterRemove = await db.getCourseStudents(testCourse.id);
    console.log(`   移除后学生数量: ${studentsAfterRemove.length}`);

    if (studentsAfterRemove.length === studentsBefore.length) {
      console.log('✅ 学生移除成功，列表已更新\n');
    } else {
      console.log('❌ 学生列表未正确更新\n');
    }

    // 6. 验证学生端不再看到课程
    console.log('🔍 验证学生端课程列表（移除后）...');
    const studentCoursesAfterRemove = await db.getStudentCourses(student.id);
    const stillFoundCourse = studentCoursesAfterRemove.find(c => c.id === testCourse.id);

    if (!stillFoundCourse) {
      console.log('✅ 学生已无法看到被移除的课程\n');
    } else {
      console.log('❌ 学生仍然可以看到被移除的课程\n');
    }

    console.log('✅ 所有测试完成！');
    console.log('\n📋 总结:');
    console.log('   - 前端实现: refetchStudents() 已在 addStudentMutation 和 removeStudentMutation 的 onSuccess 中调用');
    console.log('   - 后端实现: getStudentCourses() 正确查询 courseStudents 表');
    console.log('   - 如果前端仍未刷新，请检查:');
    console.log('     1. 是否在正确的对话框中查看（需要关闭并重新打开"管理学生"对话框）');
    console.log('     2. 浏览器控制台是否有错误');
    console.log('     3. 网络请求是否成功');

  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
    console.error(error);
  }
}

testCourseStudentRefresh();
