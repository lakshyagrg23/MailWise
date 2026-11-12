import { Router } from "express";
import { asyncHandler as h } from "../../utils/http/asyncHandler.js";
import { aiDraftLimiter } from "../../middleware/rateLimit.js";
import { generateAiEmail } from "../../controllers/ai/generateAiEmail.js";

const router = Router();

// Stateless: turns a description into { subject, body }. Nothing is stored or sent.
router.post("/compose", aiDraftLimiter, h(generateAiEmail));

export default router;
