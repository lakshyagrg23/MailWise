import { Router } from "express";
import { getEmailById } from "../controllers/emails/getEmailById.js";
import { generateAiEmail } from "../controllers/emails/generateAiEmail.js";

const router = Router();

// AI Email Generation (must be defined before /:emailId to avoid route collision)
router.get("/email", generateAiEmail);

// Fetch single email body & attachments (supports :emailId and legacy :userId param)
router.get("/:emailId", getEmailById);

export default router;
