import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// OAuth DTOs (provider-agnostic)
type OAuthTokenResponse = {
  accessToken: string;
  tokenType?: string | null;
  expiresIn?: number | null;
  refreshToken?: string | null;
  scope?: string | null;
};

type OAuthUserInfo = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
  role?: string | null;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

class OAuthService {
  constructor(private client: AxiosInstance) {
    console.log("[OAuth] Using baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error("[OAuth] Missing OAUTH_SERVER_URL environment variable");
    }
  }

  private decodeState(state: string): string {
    try {
      const decoded = JSON.parse(atob(state));
      return decoded.redirectUri || decoded.redirect_uri || "";
    } catch {
      // 如果 state 不是 base64 编码的 JSON，返回默认的 callback URI
      return "http://localhost:3001/api/oauth/callback";
    }
  }

  async exchange(code: string, state: string): Promise<OAuthTokenResponse> {
    const payload = {
      grant_type: "authorization_code",
      code,
      redirect_uri: this.decodeState(state),
      client_id: ENV.mockOAuthClientId,
    };

    const { data } = await this.client.post("/oauth/token", payload);

    return {
      accessToken: data.access_token,
      tokenType: data.token_type ?? null,
      expiresIn: data.expires_in ?? null,
      refreshToken: data.refresh_token ?? null,
      scope: data.scope ?? null,
    };
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const { data } = await this.client.get("/oauth/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!data?.openId) {
      throw new Error("User info response missing openId");
    }

    return {
      openId: data.openId,
      name: data.name ?? null,
      email: data.email ?? null,
      loginMethod: data.loginMethod ?? data.platform ?? null,
      platform: data.platform ?? null,
      role: data.role ?? null,
    };
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly oauthService = new OAuthService(createOAuthHttpClient());

  async exchangeCodeForToken(code: string, state: string) {
    return this.oauthService.exchange(code, state);
  }

  async getUserInfo(accessToken: string) {
    return this.oauthService.getUserInfo(accessToken);
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(cookieValue: string | undefined | null) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return { openId, appId, name };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const signedInAt = new Date();
    let user = await db.getUserByOpenId(session.openId);

    if (!user) {
      await db.upsertUser({
        openId: session.openId,
        name: session.name,
        loginMethod: "mock",
        lastSignedIn: signedInAt,
      });
      user = await db.getUserByOpenId(session.openId);
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({ openId: user.openId, lastSignedIn: signedInAt });
    return user;
  }
}

export const sdk = new SDKServer();
