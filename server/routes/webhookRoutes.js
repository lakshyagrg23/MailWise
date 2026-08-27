import { Router } from "express";
import { gmailWebhook } from "../controllers/webhook/gmailWebhook.js";

const router = Router();

// Gmail Pub/Sub push notification endpoint
router.post("/gmail", gmailWebhook);

export default router;
