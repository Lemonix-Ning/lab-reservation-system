import * as db from '../server/db';

async function checkCourseStudents() {
  console.log('=== 检查课程学生关系 ===\n');

  // 获取所有课程
  const courses = await db.getAllCourses();
  console.log(`总课程数: ${courses.length}`);
  
  for (const course of courses) {
    console.log(`\n课程: ${course.name} (ID: ${course.id}, 课程号: ${course.courseNo})`);
    
    // 获取该课程的学生
    const students = await db.getCourseStudents(course.id);
    console.log(`  学生数: ${students.length}`);
    
    if (students.length > 0) {
      students.forEach((s: any) => {
        console.log(`    - ${s.studentName} (ID: ${s.studentId}, OpenID: ${s.studentOpenId})`);
      });
    }
  }

  // 检查所有学生的课程
  console.log('\n=== 检查学生的课程 ===\n');
  const allUsers = await db.getAllUsers();
  const students = allUsers.filter((u: any) => u.role === 'student');
  
  console.log(`总学生数: ${students.length}`);
  
  for (const student of students) {
    console.log(`\n学生: ${student.name} (ID: ${student.id}, OpenID: ${student.openId})`);
    
    const studentCourses = await db.getStudentCourses(student.id);
    console.log(`  课程数: ${studentCourses.length}`);
    
    if (studentCourses.length > 0) {
      studentCourses.forEach((c: any) => {
        console.log(`    - ${c.name} (ID: ${c.id}, 课程号: ${c.courseNo})`);
      });
    }
  }

  process.exit(0);
}

checkCourseStudents().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
