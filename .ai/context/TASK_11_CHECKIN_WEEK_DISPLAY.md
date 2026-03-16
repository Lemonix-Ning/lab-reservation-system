# Task 11: 修复签到历史周次显示

## 问题描述
用户反馈：签到历史显示"第?周"

## 原因分析
1. 教师开启签到时，"第几周"字段是可选的
2. 如果教师没有填写周次，`weekNo` 字段为 `null`
3. 前端直接显示 `{h.weekNo || "?"}` 导致显示"第?周"

## 解决方案

### 1. 添加周次自动计算函数
根据签到日期和学期配置自动计算周次：

```typescript
const calculateWeekNo = (sessionDate: string | Date) => {
  if (!semester?.startDate) return null;
  const start = new Date(semester.startDate);
  const session = new Date(sessionDate);
  const diffTime = session.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNo = Math.floor(diffDays / 7) + 1;
  return weekNo > 0 && weekNo <= (semester.weekCount || 20) ? weekNo : null;
};
```

### 2. 签到历史表格优化
使用计算函数作为后备方案：

```typescript
const displayWeekNo = h.weekNo || (h.sessionDate ? calculateWeekNo(h.sessionDate) : null);
```

### 3. 开启签到对话框优化
自动填充当前周次，减少教师手动输入：

```typescript
useEffect(() => {
  if (isStartDialogOpen && semester?.startDate && !startForm.weekNo) {
    const currentWeekNo = calculateWeekNo(new Date());
    if (currentWeekNo) {
      setStartForm(prev => ({ ...prev, weekNo: currentWeekNo.toString() }));
    }
  }
}, [isStartDialogOpen, semester?.startDate]);
```

## 改进效果
- ✅ 历史记录自动显示正确的周次
- ✅ 即使教师没填写周次，也能根据日期计算
- ✅ 开启签到时自动填充当前周次
- ✅ 提升用户体验，减少手动输入

## 相关文件
- `client/src/pages/ClassCheckin.tsx` - 课堂签到页面
