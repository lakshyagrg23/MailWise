import { Router } from "express";
import { asyncHandler as h } from "../utils/asyncHandler.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { url } from "../controllers/auth/url.js";
import { callback } from "../controllers/auth/callback.js";
import { demoLogin } from "../controllers/auth/demoLogin.js";
import { me } from "../controllers/auth/me.js";
import { logout } from "../controllers/auth/logout.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// /me is called on every SPA boot and is already behind requireAuth, so it is not IP-limited
router.get("/me", requireAuth, h(me));

router.get("/url", authLimiter, url);
router.get("/callback", authLimiter, h(callback));
// POST: it resets the shared demo data and starts a session, so it must not be a safe/GET request
router.post("/demo", authLimiter, h(demoLogin));
router.post("/logout", logout);

export default router;
