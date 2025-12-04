export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  // 使用后端的 OAuth 授权端点（后端会代理到 Mock OAuth）
  const serverOrigin = import.meta.env.VITE_SERVER_ORIGIN ?? window.location.origin;
  const authorizeUrl = `${serverOrigin}/api/oauth/authorize`;
  const redirectUri = `${serverOrigin}/api/oauth/callback`;
  const state = btoa(JSON.stringify({ redirectUri }));
  const url = new URL(authorizeUrl);
  const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID ?? import.meta.env.VITE_APP_ID ?? "lab-reservation-local";
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  return url.toString();
};
