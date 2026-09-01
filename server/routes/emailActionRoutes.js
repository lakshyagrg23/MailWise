import { Router } from "express";
import { sendEmail } from "../controllers/emails/sendEmail.js";
import { clearUserEmails } from "../controllers/emails/clearUserEmails.js";
import { summarizeEmail } from "../controllers/emails/summarizeEmail.js";

const router = Router();

// Send an email transmission
router.post("/send-emails", sendEmail);

// On-demand AI Summarization with database caching
router.get("/summarize/:emailId", summarizeEmail);

// Delete/clear stored emails for a user (preserve demo user)
router.delete("/:userId", clearUserEmails);

export default router;
