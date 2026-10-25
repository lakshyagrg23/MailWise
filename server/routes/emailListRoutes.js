import { Router } from "express";
import { syncLimiter } from "../middleware/rateLimit.js";
import { getEmailsByCategory } from '../controllers/emails/getEmailsByCategory.js';

const router = Router();

// Fetch emails by category (or all emails)
router.get("/:category", syncLimiter, getEmailsByCategory);

export default router;
