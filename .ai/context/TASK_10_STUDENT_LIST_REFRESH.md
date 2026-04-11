# Task 10: 课程学生列表刷新功能

## 问题描述
用户反馈：
1. "为什么我创建的课程123e，添加学生1后学生1不显示课程"
2. "课程移除学生成功后，前端没有更新他还在，只有切换界面后才消失"

## 实现状态 ✅

### 1. 前端刷新逻辑
**文件**: `client/src/pages/CourseManage.tsx`

- ✅ 学生列表查询带 `refetch` 函数
- ✅ `addStudentMutation` 成功后调用 `refetchStudents()`
- ✅ `removeStudentMutation` 成功后调用 `refetchStudents()`
- ✅ "管理学生"对话框打开时自动刷新列表

### 2. 后端 API
**文件**: `server/routers.ts`, `server/db.ts`

- ✅ `course.getStudents`: 获取课程学生列表
- ✅ `course.addStudent`: 添加学生到课程
- ✅ `course.removeStudent`: 从课程移除学生
- ✅ `getStudentCourses`: 学生查看自己的课程

### 3. 学生端课程显示
**文件**: `client/src/pages/StudentCourses.tsx`

- ✅ 学生登录后可以看到自己被添加的课程
- ✅ 从 `courseStudents` 表正确查询数据

## 改进内容

### 对话框打开时自动刷新
```typescript
<Dialog 
  open={isStudentDialogOpen} 
  onOpenChange={(open) => {
    setIsStudentDialogOpen(open);
    // 对话框打开时刷新学生列表
    if (open && selectedCourse) {
      refetchStudents();
    }
  }}
>
```

## 使用说明

### 教师端操作流程
1. 打开"课程管理"页面
2. 点击课程卡片的"管理学生"按钮
3. 在学生列表对话框中点击"移除"按钮
4. 确认删除后，列表会自动刷新

### 学生端验证
1. 学生登录后进入"我的课程"页面
2. 可以看到教师添加的课程
3. 教师移除学生后，学生刷新页面将看不到该课程

## 测试脚本
创建了 `scripts/test-course-student-refresh.ts` 用于验证功能
