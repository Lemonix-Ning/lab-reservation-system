# 启用演示登录功能

## 功能说明

演示登录功能允许评委和访客无需注册GitHub账号，直接点击按钮快速体验系统的不同角色：
- 👑 系统管理员
- 🔧 实验室管理员  
- 👨‍🏫 教师
- 👨‍🎓 学生

## 部署步骤

### 1. 在服务器上添加环境变量

连接到阿里云服务器，编辑.env文件：

```bash
cd /root/lab-reservation-system
echo "ENABLE_DEMO_LOGIN=true" >> .env
```

### 2. 验证配置

```bash
cat .env | grep ENABLE_DEMO_LOGIN
```

应该看到：`ENABLE_DEMO_LOGIN=true`

### 3. 重新构建和部署

```bash
# 停止所有容器
docker compose down

# 重新构建应用镜像（包含最新代码）
docker compose build app

# 启动所有服务
docker compose up -d

# 查看应用日志，确认启动成功
docker compose logs -f app
```

等待约30秒，看到 `Server listening on http://0.0.0.0:3000` 表示启动成功。

### 4. 验证功能

1. 访问 http://lemonix.loc.cc
2. 应该看到登录页面底部有"演示账号快速登录"区域
3. 显示4个角色按钮：系统管理员、实验室管理员、教师、学生

### 5. 测试登录

点击任意角色按钮，应该能直接登录进入系统。

## 注意事项

1. 演示账号来自seed数据，需要确保数据库中有这些账号
2. 如果登录失败，可能需要运行seed脚本创建演示账号
3. 生产环境建议只在评审期间启用此功能，评审结束后可以关闭

## 关闭演示登录

如果需要关闭演示登录功能：

```bash
cd /root/lab-reservation-system

# 修改.env文件，将ENABLE_DEMO_LOGIN改为false
sed -i 's/ENABLE_DEMO_LOGIN=true/ENABLE_DEMO_LOGIN=false/' .env

# 重启应用
docker compose restart app
```
