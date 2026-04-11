import { describe, it, expect } from "vitest";
import {
  GitHubOAuthProvider,
  QQOAuthProvider,
  OAuthProviderFactory,
} from "./_core/oauth-providers";

describe("OAuth Providers", () => {
  describe("GitHubOAuthProvider", () => {
    it("should generate correct authorization URL", () => {
      const provider = new GitHubOAuthProvider("test-client-id", "test-secret");
      const url = provider.getAuthorizationUrl(
        "http://localhost:3000/callback",
        "test-state"
      );

      expect(url).toContain("https://github.com/login/oauth/authorize");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback");
      expect(url).toContain("state=test-state");
      expect(url).toContain("scope=read%3Auser+user%3Aemail");
    });

    it("should have correct provider name", () => {
      const provider = new GitHubOAuthProvider("test-client-id", "test-secret");
      expect(provider.name).toBe("github");
    });
  });

  describe("QQOAuthProvider", () => {
    it("should generate correct authorization URL", () => {
      const provider = new QQOAuthProvider("test-app-id", "test-app-key");
      const url = provider.getAuthorizationUrl(
        "http://localhost:3000/callback",
        "test-state"
      );

      expect(url).toContain("https://graph.qq.com/oauth2.0/authorize");
      expect(url).toContain("client_id=test-app-id");
      expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback");
      expect(url).toContain("state=test-state");
      expect(url).toContain("scope=get_user_info");
    });

    it("should have correct provider name", () => {
      const provider = new QQOAuthProvider("test-app-id", "test-app-key");
      expect(provider.name).toBe("qq");
    });
  });

  describe("OAuthProviderFactory", () => {
    it("should register and retrieve providers", () => {
      const factory = new OAuthProviderFactory();
      const githubProvider = new GitHubOAuthProvider("test-id", "test-secret");

      factory.registerProvider(githubProvider);

      expect(factory.hasProvider("github")).toBe(true);
      expect(factory.hasProvider("qq")).toBe(false);

      const retrieved = factory.getProvider("github");
      expect(retrieved).toBe(githubProvider);
    });

    it("should throw error for unregistered provider", () => {
      const factory = new OAuthProviderFactory();

      expect(() => factory.getProvider("github")).toThrow(
        "OAuth provider 'github' not registered"
      );
    });

    it("should list all registered providers", () => {
      const factory = new OAuthProviderFactory();
      factory.registerProvider(new GitHubOAuthProvider("id1", "secret1"));
      factory.registerProvider(new QQOAuthProvider("id2", "key2"));

      const providers = factory.getAllProviders();
      expect(providers).toHaveLength(2);
      expect(providers).toContain("github");
      expect(providers).toContain("qq");
    });
  });
});
