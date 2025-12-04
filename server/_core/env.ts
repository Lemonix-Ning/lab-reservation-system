export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  mockOAuthEnabled: process.env.MOCK_OAUTH_ENABLED === "true",
  mockOAuthOpenId: process.env.MOCK_OPEN_ID ?? "qq-admin-openid",
  mockOAuthAuthorizeUrl: process.env.VITE_OAUTH_AUTHORIZE_URL ?? "http://localhost:4000/oauth/authorize",
  mockOAuthClientId: process.env.OAUTH_CLIENT_ID ?? "local-client-id",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
