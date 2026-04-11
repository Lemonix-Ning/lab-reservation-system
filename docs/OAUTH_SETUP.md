# OAuth 多登录配置指南

本系统支持多种 OAuth 登录方式：GitHub、QQ、学校统一认证、Manus（Mock）。

## 目录
- [GitHub OAuth 配置](#github-oauth-配置)
- [QQ OAuth 配置](#qq-oauth-配置)
- [学校统一认证配置](#学校统一认证配置)
- [测试与验证](#测试与验证)

---

## GitHub OAuth 配置

### 1. 创建 GitHub OAuth App

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 "New OAuth App"
3. 填写应用信息：
   - **Application name**: `实验室预约系统`
   - **Homepage URL**: `http://localhost:3000`（开发环境）
   - **Authorization callback URL**: `http://localhost:3000/api/oauth/github/callback`
4. 点击 "Register application"
5. 记录 **Client ID** 和 **Client Secret**

### 2. 配置环境变量

在 `.env` 文件中添加：

```env
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
```

### 3. 生产环境配置

生产环境需要修改回调地址：

```
Authorization callback URL: https://your-domain.com/api/oauth/github/callback
```

并更新 `.env`：

```env
GITHUB_CLIENT_ID="your_production_client_id"
GITHUB_CLIENT_SECRET="your_production_client_secret"
```

---

## QQ OAuth 配置

### 1. 创建 QQ 互联应用

1. 访问 [QQ 互联管理中心](https://connect.qq.com/manage.html)
2. 注册成为开发者（需要实名认证）
3. 创建网站应用：
   - **网站名称**: `实验室预约系统`
   - **网站地址**: `http://localhost:3000`（开发环境）
   - **网站备案号**: 开发环境可填写测试
   - **回调地址**: `http://localhost:3000/api/oauth/qq/callback`
4. 提交审核（开发环境可使用测试模式）
5. 记录 **APP ID** 和 **APP Key**

### 2. 配置环境变量

在 `.env` 文件中添加：

```env
QQ_APP_ID="your_qq_app_id"
QQ_APP_KEY="your_qq_app_key"
```

### 3. 生产环境配置

生产环境需要：
1. 完成网站备案
2. 修改回调地址为 HTTPS：`https://your-domain.com/api/oauth/qq/callback`
3. 重新提交审核

---

## 学校统一认证配置

### 1. 对接学校 CAS/OAuth 服务

联系学校信息中心获取：
- OAuth 授权端点
- Token 端点
- 用户信息端点
- Client ID 和 Client Secret

### 2. 实现学校 OAuth 提供商

在 `server/_core/oauth-providers.ts` 中添加：

```typescript
export class SchoolOAuthProvider implements IOAuthProvider {
  readonly name: OAuthProvider = "school";
  private client: AxiosInstance;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private baseUrl: string
  ) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: AXIOS_TIMEOUT_MS,
    });
  }

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: "openid profile email",
    });
    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const { data } = await this.client.post("/oauth/token", {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
    };
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const { data } = await this.client.get("/oauth/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      provider: "school",
      providerUserId: data.student_id || data.teacher_id || data.sub,
      email: data.email,
      name: data.name,
      avatar: data.avatar,
    };
  }
}
```

### 3. 注册提供商

在 `server/_core/oauth.ts` 中添加：

```typescript
// 注册学校 OAuth
if (ENV.schoolOAuthUrl && ENV.schoolClientId && ENV.schoolClientSecret) {
  providerFactory.registerProvider(
    new SchoolOAuthProvider(
      ENV.schoolClientId,
      ENV.schoolClientSecret,
      ENV.schoolOAuthUrl
    )
  );
}
```

### 4. 配置环境变量

```env
SCHOOL_OAUTH_URL="https://auth.your-school.edu.cn"
SCHOOL_CLIENT_ID="your_school_client_id"
SCHOOL_CLIENT_SECRET="your_school_client_secret"
```

---

## 测试与验证

### 1. 启动开发服务器

```bash
pnpm dev
```

### 2. 访问登录页面

打开浏览器访问：`http://localhost:3000/login`

### 3. 测试登录流程

1. 点击对应的 OAuth 提供商按钮
2. 完成授权流程
3. 验证是否成功跳转回系统首页
4. 检查用户信息是否正确

### 4. 测试账号绑定

1. 登录后访问：`http://localhost:3000/account/bindings`
2. 绑定其他 OAuth 账号
3. 退出登录，使用其他账号登录
4. 验证是否能访问同一个用户账号

### 5. 查看日志

后端日志会显示 OAuth 流程：

```
[OAuth github] Starting callback with code: xxx
[OAuth github] Got access token
[OAuth github] Got user info: {"provider":"github","providerUserId":"12345",...}
[OAuth github] User authenticated: github-12345
[OAuth github] Session cookie set, redirecting to /
```

---

## 常见问题

### Q1: GitHub OAuth 回调失败

**原因**: 回调地址不匹配

**解决方案**:
1. 检查 GitHub OAuth App 的回调地址是否为 `http://localhost:3000/api/oauth/github/callback`
2. 确保端口号与实际运行端口一致
3. 开发环境使用 HTTP，生产环境使用 HTTPS

### Q2: QQ OAuth 提示 "redirect_uri 不合法"

**原因**: 回调地址未在 QQ 互联后台配置

**解决方案**:
1. 登录 QQ 互联管理中心
2. 编辑应用，添加回调地址
3. 等待审核通过（测试模式立即生效）

### Q3: 用户绑定多个账号后，如何合并数据？

**当前行为**: 
- 首次使用某个 OAuth 登录时，会创建新用户
- 后续绑定其他 OAuth 时，会关联到同一个用户
- 不支持自动合并已有的多个用户账号

**手动合并方案**:
1. 管理员在数据库中手动更新 `user_oauth_bindings` 表的 `userId`
2. 将多个绑定记录指向同一个用户 ID

### Q4: 如何禁用某个 OAuth 提供商？

**方案 1**: 删除环境变量

```env
# 注释掉或删除对应的配置
# GITHUB_CLIENT_ID="..."
# GITHUB_CLIENT_SECRET="..."
```

**方案 2**: 前端隐藏按钮

在 `client/src/pages/Login.tsx` 中过滤：

```typescript
const visibleProviders = availableProviders.filter(p => p !== 'github');
```

---

## 安全建议

1. **生产环境必须使用 HTTPS**
   - OAuth 回调地址必须是 HTTPS
   - Cookie 设置 `secure: true`

2. **保护 Client Secret**
   - 不要提交到 Git 仓库
   - 使用环境变量或密钥管理服务

3. **验证 State 参数**
   - 防止 CSRF 攻击
   - 当前实现已包含 state 验证

4. **限制回调地址**
   - 只配置必要的回调地址
   - 避免使用通配符

5. **定期更新 Token**
   - 实现 Refresh Token 机制
   - 定期检查 Token 有效期

---

## 参考文档

- [GitHub OAuth 文档](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [QQ 互联文档](https://wiki.connect.qq.com/)
- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)

---

**最后更新**: 2026-01-30  
**文档版本**: v1.0.0
