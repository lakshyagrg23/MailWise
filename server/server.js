import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from "./routes/authRoutes.js";
import emailListRoutes from "./routes/emailListRoutes.js";
import emailDetailRoutes from "./routes/emailDetailRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import emailActionRoutes from "./routes/emailActionRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { authLimiter } from "./middleware/rateLimit.js";
import { assertSessionConfig } from "./utils/session.js";

// Fail fast if the session secret is missing or too weak
assertSessionConfig();

BigInt.prototype.toJSON = function() { return this.toString(); };

const app = express();

// Behind nginx/ALB: needed so Secure cookies and req.ip work
app.set('trust proxy', 1);

// Env-driven CORS allowlist; localhost dev origins only outside production
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost', 'http://localhost:3000', 'http://localhost:80']
    : [])
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

// Public routes
app.use("/auth", authLimiter, authRoutes);
app.use("/webhook", webhookRoutes);

// Authenticated routes (identity comes only from the signed session cookie)
app.use("/fetch-emails", requireAuth, emailListRoutes);
app.use("/fetch-email", requireAuth, emailDetailRoutes);
app.use("/categories", requireAuth, categoryRoutes);
app.use("/email", requireAuth, emailActionRoutes);
app.use("/emails", requireAuth, emailActionRoutes);

// Centralized error handler (never leak err.message to clients)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
