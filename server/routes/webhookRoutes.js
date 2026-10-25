import { Router } from "express";
import { gmailWebhook } from "../controllers/webhook/gmailWebhook.js";
import { verifyPubSubToken } from "../utils/verifyPubSubToken.js";

const router = Router();

// Gmail Pub/Sub push notification endpoint (OIDC-authenticated)
router.post("/gmail", verifyPubSubToken, gmailWebhook);

export default router;
