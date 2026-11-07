import { Router } from "express";
import { summarizeLimiter } from "../middleware/rateLimit.js";
import { sendEmail } from "../controllers/emails/sendEmail.js";
import { saveDraft, getDraft, deleteDraft } from "../controllers/emails/drafts.js";
import { markRead, setStar } from "../controllers/emails/markRead.js";
import { clearUserEmails } from "../controllers/emails/clearUserEmails.js";
import { summarizeEmail } from "../controllers/emails/summarizeEmail.js";

const router = Router();

// Send an email transmission
router.post("/send-emails", sendEmail);

// Local read/unread state
router.post("/read/:emailId", markRead);
router.post("/star/:emailId", setStar);

// Gmail drafts
router.post("/drafts", saveDraft);
router.get("/drafts/:draftId", getDraft);
router.delete("/drafts/:draftId", deleteDraft);

// On-demand AI Summarization with database caching
router.get("/summarize/:emailId", summarizeLimiter, summarizeEmail);

// Delete/clear the authenticated user's stored emails (demo user preserved)
router.delete("/", clearUserEmails);

export default router;
