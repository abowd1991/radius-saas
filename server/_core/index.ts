import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startMonitor } from "../services/sessionMonitor";
import { startSubscriptionNotifier } from "../services/subscriptionNotifier";
import { startAlertMonitor } from "../services/alertMonitor";
import { startSubscriptionEnforcer } from "../services/subscriptionEnforcer";
import { startProvisioningMonitor } from "../services/provisioningService";
import multer from "multer";
import { storagePut } from "../storage";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";
import cookieParser from "cookie-parser";

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
  app.use(cookieParser());
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Avatar upload endpoint
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  });
  
  app.post("/api/upload/avatar", upload.single("file"), async (req, res) => {
    try {
      // Verify user is authenticated
      const token = req.cookies?.[COOKIE_NAME];
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const session = await sdk.verifySession(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Generate unique filename
      const ext = file.originalname.split(".").pop() || "jpg";
      const filename = `avatars/${session.openId}-${Date.now()}.${ext}`;
      
      // Upload to S3
      const { url } = await storagePut(filename, file.buffer, file.mimetype);
      
      res.json({ url });
    } catch (error) {
      console.error("Avatar upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });
  
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
    
    // Start session monitor (check every 30 seconds for expired sessions)
    startMonitor(30000);
    console.log('[SessionMonitor] Started - checking for expired sessions every 30 seconds');
    
    // Start subscription expiration notifier (check every 6 hours)
    startSubscriptionNotifier();
    console.log('[SubscriptionNotifier] Started - checking for expiring subscriptions every 6 hours');
    
    // Start alert monitor for card expiration and NAS connection
    startAlertMonitor();
    console.log('[AlertMonitor] Started - checking for alerts every 5 minutes');
    
    // Start subscription enforcer for expired trials/subscriptions
    startSubscriptionEnforcer();
    console.log('[SubscriptionEnforcer] Started - checking for expired accounts every 5 minutes');
    
    // Start provisioning monitor for VPN NAS devices
    startProvisioningMonitor();
    console.log('[ProvisioningMonitor] Started - checking for pending NAS every 30 seconds');
  });
}

startServer().catch(console.error);
