import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import v1Routes from "./routes/v1/index.js";
import { toErrorResponse } from "./utils/httpErrors.js";

BigInt.prototype.toJSON = function() { return this.toString(); };

/**
 * Builds the Express app without listening, so tests can mount it on an ephemeral port.
 * server.js validates the environment and starts the listener.
 */
export const createApp = () => {
  const app = express();

  // Behind nginx/ALB: needed so Secure cookies and req.ip work
  app.set('trust proxy', 1);

  // Env-driven CORS allowlist; localhost dev origins only outside production
  const allowedOrigins = [
    env.frontendUrl,
    ...(!env.isProduction
      ? ['http://localhost', 'http://localhost:3000', 'http://localhost:80']
      : [])
  ].filter(Boolean);

  app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }));

  app.use(cookieParser());
  app.use(express.json());

  // Unversioned: URLs registered with / followed by external parties (Google OAuth, Pub/Sub)
  app.use("/auth", authRoutes);
  app.use("/webhook", webhookRoutes);

  // Resource API (authenticated; see routes/v1/index.js)
  app.use("/api/v1", v1Routes);

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  // Unknown routes
  app.use((req, res) => res.status(404).json({ error: "Not found" }));

  // Centralized error handler (never leaks err.message of unexpected errors to clients)
  app.use((err, req, res, next) => {
    const { status, body } = toErrorResponse(err);
    if (status >= 500) console.error("Unhandled error:", err);
    if (res.headersSent) return next(err);
    res.status(status).json(body);
  });

  return app;
};
