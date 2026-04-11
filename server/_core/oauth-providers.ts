/**
 * OAuth 提供商抽象层
 * 支持多种 OAuth 登录方式：GitHub, QQ, 学校统一认证, Manus
 */

import axios, { type AxiosInstance } from "axios";
import { AXIOS_TIMEOUT_MS } from "@shared/const";

// OAuth 提供商类型
export type OAuthProvider = "github" | "qq" | "school";

// OAuth 用户信息（标准化）
export interface OAuthUserInfo {
  provider: OAuthProvider;
  providerUserId: string; // 提供商的用户ID
  email?: string | null;
  name?: string | null;
  avatar?: string | null;
}

// OAuth Token 响应
export interface OAuthTokenResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
}

// OAuth 提供商接口
export interface IOAuthProvider {
  readonly name: OAuthProvider;
  getAuthorizationUrl(redirectUri: string, state: string): string;
  exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse>;
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}

/**
 * GitHub OAuth 提供商
 * 文档: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 */
export class GitHubOAuthProvider implements IOAuthProvider {
  readonly name: OAuthProvider = "github";
  private client: AxiosInstance;

  constructor(
    private clientId: string,
    private clientSecret: string
  ) {
    this.client = axios.create({
      timeout: AXIOS_TIMEOUT_MS,
    });
  }

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: "read:user user:email",
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const { data } = await this.client.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // 获取用户基本信息
    const { data: user } = await this.client.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    // 获取用户邮箱（可能需要单独请求）
    let email = user.email;
    if (!email) {
      try {
        const { data: emails } = await this.client.get("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });
        const primaryEmail = emails.find((e: any) => e.primary && e.verified);
        email = primaryEmail?.email || emails[0]?.email;
      } catch (error) {
        console.warn("[GitHub OAuth] Failed to fetch emails:", error);
      }
    }

    return {
      provider: "github",
      providerUserId: String(user.id),
      email: email || null,
      name: user.name || user.login || null,
      avatar: user.avatar_url || null,
    };
  }
}

/**
 * QQ OAuth 提供商
 * 文档: https://wiki.connect.qq.com/oauth2-0%e7%ae%80%e4%bb%8b
 */
export class QQOAuthProvider implements IOAuthProvider {
  readonly name: OAuthProvider = "qq";
  private client: AxiosInstance;

  constructor(
    private appId: string,
    private appKey: string
  ) {
    this.client = axios.create({
      timeout: AXIOS_TIMEOUT_MS,
    });
  }

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.appId,
      redirect_uri: redirectUri,
      state,
      scope: "get_user_info",
    });
    return `https://graph.qq.com/oauth2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.appId,
      client_secret: this.appKey,
      code,
      redirect_uri: redirectUri,
    });

    const { data } = await this.client.get(
      `https://graph.qq.com/oauth2.0/token?${params.toString()}`
    );

    // QQ 返回格式: access_token=xxx&expires_in=7776000&refresh_token=xxx
    const tokenParams = new URLSearchParams(data);
    const accessToken = tokenParams.get("access_token");
    const expiresIn = tokenParams.get("expires_in");
    const refreshToken = tokenParams.get("refresh_token");

    if (!accessToken) {
      throw new Error("Failed to get access token from QQ");
    }

    return {
      accessToken,
      expiresIn: expiresIn ? parseInt(expiresIn) : undefined,
      refreshToken: refreshToken || undefined,
    };
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // 1. 获取 OpenID
    const { data: openIdData } = await this.client.get(
      `https://graph.qq.com/oauth2.0/me?access_token=${accessToken}`
    );

    // 返回格式: callback( {"client_id":"YOUR_APPID","openid":"YOUR_OPENID"} );
    const openIdMatch = openIdData.match(/"openid":"([^"]+)"/);
    if (!openIdMatch) {
      throw new Error("Failed to get OpenID from QQ");
    }
    const openId = openIdMatch[1];

    // 2. 获取用户信息
    const userInfoParams = new URLSearchParams({
      access_token: accessToken,
      oauth_consumer_key: this.appId,
      openid: openId,
    });

    const { data: userInfo } = await this.client.get(
      `https://graph.qq.com/user/get_user_info?${userInfoParams.toString()}`
    );

    if (userInfo.ret !== 0) {
      throw new Error(`QQ API error: ${userInfo.msg}`);
    }

    return {
      provider: "qq",
      providerUserId: openId,
      name: userInfo.nickname || null,
      avatar: userInfo.figureurl_qq_2 || userInfo.figureurl_qq_1 || null,
      email: null, // QQ 不提供邮箱
    };
  }
}

/**
 * OAuth 提供商工厂
 */
export class OAuthProviderFactory {
  private providers = new Map<OAuthProvider, IOAuthProvider>();

  registerProvider(provider: IOAuthProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: OAuthProvider): IOAuthProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`OAuth provider '${name}' not registered`);
    }
    return provider;
  }

  hasProvider(name: OAuthProvider): boolean {
    return this.providers.has(name);
  }

  getAllProviders(): OAuthProvider[] {
    return Array.from(this.providers.keys());
  }
}
