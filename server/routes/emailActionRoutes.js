import { Router } from "express";
import { summarizeLimiter } from "../middleware/rateLimit.js";
import { sendEmail } from "../controllers/emails/sendEmail.js";
import { clearUserEmails } from "../controllers/emails/clearUserEmails.js";
import { summarizeEmail } from "../controllers/emails/summarizeEmail.js";

const router = Router();

// Send an email transmission
router.post("/send-emails", sendEmail);

// On-demand AI Summarization with database caching
router.get("/summarize/:emailId", summarizeLimiter, summarizeEmail);

// Delete/clear the authenticated user's stored emails (demo user preserved)
router.delete("/", clearUserEmails);

export default router;
