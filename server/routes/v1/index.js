import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { asyncHandler as h } from "../../utils/asyncHandler.js";
import { listSentEmails } from "../../controllers/emails/listSentEmails.js";
import emailRoutes from "./emailRoutes.js";
import draftRoutes from "./draftRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import aiRoutes from "./aiRoutes.js";

/**
 * Resource API, mounted at /api/v1. Authentication is applied once here; identity comes only
 * from req.user (the signed session cookie), never from the path, query or body.
 *
 *   /emails       classified mail stored in PostgreSQL (+ sync, send, flag updates, summary)
 *   /sent         live Gmail view of sent mail
 *   /drafts       Gmail drafts
 *   /categories   the user's classification categories
 *   /ai           stateless AI helpers
 *
 * /auth and /webhook stay unversioned on purpose: their URLs are registered with Google
 * (OAuth redirect URI, Pub/Sub push endpoint) and the browser follows them directly.
 */
const v1 = Router();

v1.use(requireAuth);

v1.use("/emails", emailRoutes);
v1.get("/sent", h(listSentEmails));
v1.use("/drafts", draftRoutes);
v1.use("/categories", categoryRoutes);
v1.use("/ai", aiRoutes);

export default v1;
