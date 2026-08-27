import { Router } from "express";
import { getEmailsByCategory } from '../controllers/emails/getEmailsByCategory.js';

const router = Router();

// Fetch emails by category (or all emails)
router.get("/:category", getEmailsByCategory);

export default router;
