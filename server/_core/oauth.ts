import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { 
  OAuthProviderFactory, 
  GitHubOAuthProvider, 
  QQOAuthProvider,
  type OAuthProvider 
} from "./oauth-providers";
import { ENV } from "./env";

async function resolveInitialRole(email?: string | null) {
  if (!email) {
    return "student" as const;
  }

  const whitelist = await db.getWhitelistByEmail(email);
  if (whitelist) {
    return whitelist.role;
  }

  return "student" as const;
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

// 初始化 OAuth 提供商工厂
const providerFactory = new OAuthProviderFactory();

// 注册 GitHub OAuth
if (ENV.githubClientId && ENV.githubClientSecret) {
  providerFactory.registerProvider(
    new GitHubOAuthProvider(ENV.githubClientId, ENV.githubClientSecret)
  );
  console.log("[OAuth] GitHub provider registered");
}

// 注册 QQ OAuth
if (ENV.qqAppId && ENV.qqAppKey) {
  providerFactory.registerProvider(
    new QQOAuthProvider(ENV.qqAppId, ENV.qqAppKey)
  );
  console.log("[OAuth] QQ provider registered");
}

// 检查是否至少有一个提供商可用
const availableProviders = providerFactory.getAllProviders();
if (availableProviders.length === 0) {
  console.warn("[OAuth] ⚠️  No OAuth providers configured! Please configure at least one:");
  console.warn("  - GitHub: Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET");
  console.warn("  - QQ: Set QQ_APP_ID and QQ_APP_KEY");
} else {
  console.log(`[OAuth] ✓ ${availableProviders.length} provider(s) available:`, availableProviders.join(", "));
}

export function registerOAuthRoutes(app: Express) {
  // 获取可用的 OAuth 提供商列表
  app.get("/api/oauth/providers", (req: Request, res: Response) => {
    const providers = providerFactory.getAllProviders();
    res.json({ providers });
  });

  // OAuth 授权请求（支持多提供商）
  app.get("/api/oauth/:provider/authorize", async (req: Request, res: Response) => {
    const providerName = req.params.provider as OAuthProvider;
    
    if (!providerFactory.hasProvider(providerName)) {
      res.status(400).json({ error: `Unsupported OAuth provider: ${providerName}` });
      return;
    }

    try {
      const provider = providerFactory.getProvider(providerName);
      const redirectUri = `${req.protocol}://${req.get("host")}/api/oauth/${providerName}/callback`;
      
      // 生成 state（包含 redirectUri 和 provider 信息）
      const state = Buffer.from(
        JSON.stringify({
          redirectUri,
          provider: providerName,
          timestamp: Date.now(),
        })
      ).toString("base64");

      const authUrl = provider.getAuthorizationUrl(redirectUri, state);
      res.redirect(302, authUrl);
    } catch (error) {
      console.error(`[OAuth ${providerName}] Authorization failed:`, error);
      res.status(500).json({ error: "OAuth authorization failed" });
    }
  });

  // OAuth 回调（支持多提供商）
  app.get("/api/oauth/:provider/callback", async (req: Request, res: Response) => {
    const providerName = req.params.provider as OAuthProvider;
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    if (!providerFactory.hasProvider(providerName)) {
      res.status(400).json({ error: `Unsupported OAuth provider: ${providerName}` });
      return;
    }

    try {
      console.log(`[OAuth ${providerName}] Starting callback with code:`, code);
      
      // 解析 state
      const stateData = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
      const redirectUri = stateData.redirectUri;

      const provider = providerFactory.getProvider(providerName);
      
      // 1. 交换 code 获取 access token
      const tokenResponse = await provider.exchangeCodeForToken(code, redirectUri);
      console.log(`[OAuth ${providerName}] Got access token`);
      
      // 2. 获取用户信息
      const userInfo = await provider.getUserInfo(tokenResponse.accessToken);
      console.log(`[OAuth ${providerName}] Got user info:`, JSON.stringify(userInfo));

      // 3. 查找或创建用户
      let user = await db.getUserByOAuthBinding(providerName, userInfo.providerUserId);
      
      if (!user) {
        // 新用户：创建用户并绑定 OAuth
        const openId = `${providerName}-${userInfo.providerUserId}`;

        const role = await resolveInitialRole(userInfo.email || null);
        
        await db.upsertUser({
          openId,
          name: userInfo.name || null,
          email: userInfo.email || null,
          loginMethod: providerName,
          role,
          lastSignedIn: new Date(),
        });

        user = await db.getUserByOpenId(openId);
        
        if (user) {
          // 创建 OAuth 绑定记录
          await db.createOAuthBinding({
            userId: user.id,
            provider: providerName,
            providerUserId: userInfo.providerUserId,
            providerEmail: userInfo.email || null,
            providerName: userInfo.name || null,
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken || null,
            tokenExpiresAt: tokenResponse.expiresIn 
              ? new Date(Date.now() + tokenResponse.expiresIn * 1000)
              : null,
          });
        }
      } else {
        // 已有用户：更新最后登录时间和 OAuth 绑定
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        await db.updateOAuthBinding(providerName, userInfo.providerUserId, {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken || null,
          tokenExpiresAt: tokenResponse.expiresIn
            ? new Date(Date.now() + tokenResponse.expiresIn * 1000)
            : null,
          lastUsedAt: new Date(),
        });
      }

      if (!user) {
        throw new Error("Failed to create or find user");
      }

      console.log(`[OAuth ${providerName}] User authenticated:`, user.openId);

      // 4. 创建会话
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      console.log(`[OAuth ${providerName}] Session cookie set, redirecting to /`);
      res.redirect(302, "/");
    } catch (error) {
      console.error(`[OAuth ${providerName}] Callback failed:`, error);
      res.status(500).json({ 
        error: "OAuth callback failed",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
