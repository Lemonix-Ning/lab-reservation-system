import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // 代理 OAuth 授权请求到 Mock OAuth 服务
  app.get("/api/oauth/authorize", async (req: Request, res: Response) => {
    const mockOAuthUrl = process.env.VITE_OAUTH_AUTHORIZE_URL ?? "http://localhost:4000/oauth/authorize";
    const queryParams = new URLSearchParams(req.query as Record<string, string>);
    const redirectUrl = `${mockOAuthUrl}?${queryParams.toString()}`;
    res.redirect(302, redirectUrl);
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      console.log("[OAuth] Starting callback with code:", code, "state:", state);
      
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      console.log("[OAuth] Got token:", tokenResponse.accessToken);
      
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      console.log("[OAuth] Got userInfo:", JSON.stringify(userInfo));

      if (!userInfo.openId) {
        console.error("[OAuth] Missing openId in userInfo");
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // 验证角色类型
      const validRoles = ['student', 'teacher', 'labAdmin', 'sysAdmin'];
      const role = userInfo.role && validRoles.includes(userInfo.role) ? userInfo.role as 'student' | 'teacher' | 'labAdmin' | 'sysAdmin' : undefined;
      
      console.log("[OAuth] User role:", userInfo.role, "-> validated role:", role);

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
        role: role,
      });

      console.log("[OAuth] User upserted successfully");

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      console.log("[OAuth] Session cookie set, redirecting to /");
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
