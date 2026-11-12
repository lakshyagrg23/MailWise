import { Router } from "express";
import { asyncHandler as h } from "../../utils/http/asyncHandler.js";
import { listSentEmails } from "../../controllers/sent/listSentEmails.js";

const router = Router();

// Sent mail is not stored or classified: a live Gmail view, paged with ?pageToken=
router.get("/", h(listSentEmails));

export default router;
