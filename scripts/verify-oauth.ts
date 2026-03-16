/**
 * OAuth 配置验证脚本
 * 检查 OAuth 提供商是否正确配置
 */

import { ENV } from "../server/_core/env";

console.log("=".repeat(60));
console.log("OAuth 配置验证");
console.log("=".repeat(60));

// 检查 GitHub OAuth
console.log("\n📌 GitHub OAuth:");
if (ENV.githubClientId && ENV.githubClientSecret) {
  console.log("  ✅ GITHUB_CLIENT_ID:", ENV.githubClientId.substring(0, 10) + "...");
  console.log("  ✅ GITHUB_CLIENT_SECRET:", "***" + ENV.githubClientSecret.substring(ENV.githubClientSecret.length - 4));
  console.log("  ✅ 回调地址: http://localhost:3000/api/oauth/github/callback");
  console.log("  ℹ️  请确认 GitHub OAuth App 配置:");
  console.log("     https://github.com/settings/developers");
} else {
  console.log("  ❌ 未配置");
  console.log("  ℹ️  请在 .env 中配置:");
  console.log("     GITHUB_CLIENT_ID=your_client_id");
  console.log("     GITHUB_CLIENT_SECRET=your_client_secret");
}

// 检查 QQ OAuth
console.log("\n📌 QQ OAuth:");
if (ENV.qqAppId && ENV.qqAppKey) {
  console.log("  ✅ QQ_APP_ID:", ENV.qqAppId);
  console.log("  ✅ QQ_APP_KEY:", "***" + ENV.qqAppKey.substring(ENV.qqAppKey.length - 4));
  console.log("  ✅ 回调地址: http://localhost:3000/api/oauth/qq/callback");
} else {
  console.log("  ❌ 未配置");
  console.log("  ℹ️  请在 .env 中配置:");
  console.log("     QQ_APP_ID=your_app_id");
  console.log("     QQ_APP_KEY=your_app_key");
}

// 总结
console.log("\n" + "=".repeat(60));
const githubOk = !!(ENV.githubClientId && ENV.githubClientSecret);
const qqOk = !!(ENV.qqAppId && ENV.qqAppKey);

if (githubOk || qqOk) {
  console.log("✅ 至少有一个 OAuth 提供商已配置");
  console.log("\n下一步:");
  console.log("  1. 启动服务器: pnpm dev");
  console.log("  2. 访问登录页: http://localhost:3000/login");
  console.log("  3. 点击对应的登录按钮测试");
} else {
  console.log("⚠️  没有配置任何 OAuth 提供商");
  console.log("\n建议:");
  console.log("  1. 配置 GitHub OAuth（推荐）");
  console.log("  2. 或使用开发模式的演示账号登录");
}

console.log("=".repeat(60));
