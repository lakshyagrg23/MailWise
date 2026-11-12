import { Router } from "express";
import { asyncHandler as h } from "../utils/asyncHandler.js";
import { gmailWebhook } from "../controllers/webhook/gmailWebhook.js";
import { verifyPubSubToken } from "../middleware/verifyPubSubToken.js";

const router = Router();

// Gmail Pub/Sub push notification endpoint (OIDC-authenticated)
router.post("/gmail", verifyPubSubToken, h(gmailWebhook));

export default router;
