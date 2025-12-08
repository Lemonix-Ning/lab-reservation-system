import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.MOCK_OAUTH_PORT ? Number(process.env.MOCK_OAUTH_PORT) : 4000;
const MOCK_OPEN_ID = process.env.MOCK_OPEN_ID || "qq-admin-openid";
const MOCK_NAME = process.env.MOCK_NAME || "Mock Admin";
const MOCK_EMAIL = process.env.MOCK_EMAIL || "admin@example.com";
const MOCK_ACCESS_TOKEN = process.env.MOCK_ACCESS_TOKEN || "mock-access-token";
const CLIENT_ID = process.env.OAUTH_CLIENT_ID || "local-client-id";

// 默认角色映射（旧系统兼容性）
const ROLE_MAPPING: Record<string, string> = {
  'admin': 'sysAdmin',
  'user': 'student',
  'student': 'student',
  'teacher': 'teacher',
  'labAdmin': 'labAdmin',
  'sysAdmin': 'sysAdmin',
};

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 支持直接登录（带用户信息）
app.get("/oauth/authorize", (req, res) => {
  const { redirect_uri, state, openid, name, email, role } = req.query as Record<string, string>;

  // 如果提供了用户信息，直接设置到环境变量（用于 /userinfo）
  if (openid) process.env.MOCK_OPEN_ID = openid;
  if (name) process.env.MOCK_NAME = name;
  if (email) process.env.MOCK_EMAIL = email;
  
  // 处理角色映射（支持新的四层角色系统）
  if (role) {
    const mappedRole = ROLE_MAPPING[role] || role;
    process.env.MOCK_ROLE = mappedRole;
  }

  // 如果没有 redirect_uri，使用默认值
  const finalRedirectUri = redirect_uri || "http://localhost:3001/api/oauth/callback";
  
  const code = "mock-code";
  const finalState = state || "mock-state"; // 确保总是有 state
  
  const redirect = new URL(finalRedirectUri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", finalState);
  
  res.redirect(redirect.toString());
});

app.post("/oauth/token", (req, res) => {
  const grantType = req.body?.grant_type || req.query?.grant_type;
  const clientId = req.body?.client_id || req.query?.client_id;

  if (grantType !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }
  if (clientId !== CLIENT_ID) {
    res.status(401).json({ error: "invalid_client" });
    return;
  }

  res.json({
    access_token: MOCK_ACCESS_TOKEN,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "mock-refresh-token",
    scope: "profile",
    id_token: "mock-id-token",
  });
});

app.get("/oauth/userinfo", (_req, res) => {
  res.json({
    openId: process.env.MOCK_OPEN_ID || MOCK_OPEN_ID,
    name: process.env.MOCK_NAME || MOCK_NAME,
    email: process.env.MOCK_EMAIL || MOCK_EMAIL,
    loginMethod: "mock",
    role: process.env.MOCK_ROLE || "student",
  });
});

app.listen(PORT, () => {
  console.log(`[Mock OAuth] listening on http://localhost:${PORT}`);
  console.log(`[Mock OAuth] Supports new role system: student, teacher, labAdmin, sysAdmin`);
});

