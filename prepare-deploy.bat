@echo off
chcp 65001 >nul
echo ╔══════════════════════════════════════════════════════════════╗
echo ║          实验室预约系统 - 本地部署准备脚本                  ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo 📋 步骤 1/5: 运行部署前检查...
echo.
call pnpm deploy:check
if errorlevel 1 (
    echo.
    echo ⚠️  部署前检查未通过，但可以继续
    echo.
    pause
)

echo.
echo ✅ 步骤 2/5: 生成部署密钥...
echo.
call pnpm deploy:secrets
echo.

echo ╔══════════════════════════════════════════════════════════════╗
echo ║  请复制上面的密钥，稍后在服务器上配置 .env 时需要使用      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause

echo.
echo 📝 步骤 3/5: 提交代码到 Git...
echo.
git add .
git status
echo.
set /p commit_msg="请输入提交信息（直接回车使用默认）: "
if "%commit_msg%"=="" set commit_msg=准备部署到生产环境
git commit -m "%commit_msg%"
echo.

echo 📤 步骤 4/5: 推送代码到远程仓库...
echo.
git push
if errorlevel 1 (
    echo ❌ 推送失败，请检查网络或 Git 配置
    pause
    exit /b 1
)
echo.

echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    ✅ 本地准备完成！                         ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo 📋 下一步：在服务器上执行以下命令
echo.
echo 1. SSH 连接服务器:
echo    ssh root@你的服务器IP
echo.
echo 2. 克隆项目:
echo    cd /root
echo    git clone 你的仓库地址 lab-reservation-system
echo    cd lab-reservation-system
echo.
echo 3. 运行部署脚本:
echo    bash server-deploy.sh
echo.
echo 📚 详细步骤请查看: START_DEPLOY.md
echo.
pause
