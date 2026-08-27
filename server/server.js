import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from "./routes/authRoutes.js";
import emailListRoutes from "./routes/emailListRoutes.js";
import emailDetailRoutes from "./routes/emailDetailRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import emailActionRoutes from "./routes/emailActionRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

dotenv.config();

BigInt.prototype.toJSON = function() { return this.toString(); };

const app = express();

// Define an array of allowed origins
const allowedOrigins = [
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:80',
  'https://main.d2n81lupyovp57.amplifyapp.com',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// API Routes
app.use("/auth", authRoutes);
app.use("/fetch-emails", emailListRoutes);
app.use("/fetch-email", emailDetailRoutes);
app.use("/categories", categoryRoutes);
app.use("/email", emailActionRoutes);
app.use("/emails", emailActionRoutes);
app.use("/webhook", webhookRoutes);

// Centralized error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error", details: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
