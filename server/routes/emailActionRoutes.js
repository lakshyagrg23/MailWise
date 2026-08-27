import { Router } from "express";
import { sendEmail } from "../controllers/emails/sendEmail.js";
import { clearUserEmails } from "../controllers/emails/clearUserEmails.js";

const router = Router();

// Send an email transmission
router.post("/send-emails", sendEmail);

// Delete/clear stored emails for a user (preserve demo user)
router.delete("/:userId", clearUserEmails);

export default router;
