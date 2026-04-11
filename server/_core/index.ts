import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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
  
  // 演示账号快速切换 API（用于评委快速体验系统）
  if (process.env.NODE_ENV === "development" || process.env.ENABLE_DEMO_LOGIN === "true") {
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
      
      try {
        // 从数据库获取用户信息
        const db = await getDb();
        if (!db) {
          return res.status(500).json({ error: 'Database not available' });
        }
        
        const userResult = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
        if (!userResult || userResult.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userResult[0];
        
        // 创建新的 session token
        const sessionToken = await sdk.createSessionToken(openId, {
          name: user.name || openId,
          expiresInMs: ONE_YEAR_MS,
        });
        
        // 设置 cookie
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        
        res.json({ success: true });
      } catch (error) {
        console.error('[Dev Login] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }
  
  // 检查是否启用演示登录
  app.get("/api/system/demo-login-enabled", (_req, res) => {
    const enabled = process.env.NODE_ENV === "development" || process.env.ENABLE_DEMO_LOGIN === "true";
    res.json({ enabled });
  });
  
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
