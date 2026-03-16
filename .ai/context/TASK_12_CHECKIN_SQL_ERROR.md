# Task 12: 修复签到会话创建的 SQL 错误

## 问题描述
用户遇到 500 错误：
```
Failed query: insert into `course_attendances` ... 
on duplicate key update `sessionId` = session_id
```

## 错误原因
在 `server/db.ts` 的 `initializeAttendances` 函数中，使用了错误的 SQL 语法：

```typescript
await db.insert(courseAttendances).values(values).onDuplicateKeyUpdate({
  set: { sessionId: sql`session_id` } // ❌ 错误：session_id 未定义
});
```

MySQL 报错是因为 `session_id` 在 `UPDATE` 语句中没有被正确引用。

## 解决方案
使用 `VALUES()` 函数引用插入的值：

```typescript
await db.insert(courseAttendances).values(values).onDuplicateKeyUpdate({
  set: { sessionId: sql`VALUES(sessionId)` } // ✅ 正确：引用插入的值
});
```

## 技术说明

### MySQL ON DUPLICATE KEY UPDATE 语法
当主键或唯一键冲突时，可以选择更新而不是报错：

```sql
INSERT INTO table (col1, col2) VALUES (val1, val2)
ON DUPLICATE KEY UPDATE col1 = VALUES(col1);
```

`VALUES(col)` 函数返回 INSERT 语句中指定的值。

### Drizzle ORM 用法
```typescript
db.insert(table).values(data).onDuplicateKeyUpdate({
  set: {
    column: sql`VALUES(column)`, // 使用插入的值
    // 或
    column: newValue, // 使用新值
  }
});
```

## 影响范围
- 教师开启签到会话时会触发此错误
- 批量创建学生出勤记录失败
- 导致签到功能无法使用

## 测试验证
创建了 `scripts/test-checkin-session.ts` 用于验证修复：
1. 创建测试课程和学生
2. 创建签到会话
3. 初始化出勤记录（触发批量插入）
4. 验证记录创建成功

## 相关文件
- `server/db.ts` - initializeAttendances 函数
