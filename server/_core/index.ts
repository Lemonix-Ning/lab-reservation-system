import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // 开发模式：账号快速切换 API
  if (process.env.NODE_ENV === "development") {
    app.post("/api/dev/switch-account", async (req, res) => {
      const { openId } = req.body;
      
      // 只允许切换到测试账号
      const allowedAccounts = [
        'demo-admin',
        'demo-labadmin',
        'demo-teacher-001',
        'demo-student-001',
        'sysadmin-001',
        'labadmin-001',
        'teacher-001',
        'student-001',
      ];
      if (!allowedAccounts.includes(openId)) {
        return res.status(403).json({ error: 'Not allowed' });
      }
      
      // 导入必要的模块
      const { sdk } = await import('./sdk');
      const { COOKIE_NAME, ONE_YEAR_MS } = await import('@shared/const');
      const { getSessionCookieOptions } = await import('./cookies');
      
      // 创建新的 session token
      const sessionToken = await sdk.createSessionToken(openId, {
        name: openId,
        expiresInMs: ONE_YEAR_MS,
      });
      
      // 设置 cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      
      res.json({ success: true });
    });
  }
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
