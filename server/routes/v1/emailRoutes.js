import { Router } from "express";
import { asyncHandler as h } from "../../utils/http/asyncHandler.js";
import { EMAIL_ID_RE, PART_ID_RE, validateParam } from "../../utils/http/params.js";
import { attachmentLimiter, summarizeLimiter, syncLimiter } from "../../middleware/rateLimit.js";
import { listEmails } from "../../controllers/emails/listEmails.js";
import { syncEmails } from "../../controllers/emails/syncEmails.js";
import { getEmailById } from "../../controllers/emails/getEmailById.js";
import { getAttachment } from "../../controllers/emails/getAttachment.js";
import { updateEmail } from "../../controllers/emails/updateEmail.js";
import { sendEmail } from "../../controllers/emails/sendEmail.js";
import { summarizeEmail } from "../../controllers/emails/summarizeEmail.js";
import { clearUserEmails } from "../../controllers/emails/clearUserEmails.js";

const router = Router();

router.param("emailId", validateParam(EMAIL_ID_RE, "Invalid email ID"));
router.param("partId", validateParam(PART_ID_RE, "Invalid attachment ID"));

// Collection
router.get("/", h(listEmails));                       // stored mail, optional ?category=
router.delete("/", h(clearUserEmails));               // clear the user's stored mail (demo preserved)

// Actions on the collection (static paths; none can be mistaken for an :emailId)
router.post("/sync", syncLimiter, h(syncEmails));     // pull + classify new mail from Gmail
router.post("/send", h(sendEmail));                   // send a message

// Single email
router.get("/:emailId", h(getEmailById));             // body + attachment metadata, read live from Gmail
router.get("/:emailId/attachments/:partId", attachmentLimiter, h(getAttachment)); // attachment bytes (download)
router.patch("/:emailId", h(updateEmail));            // { is_read?, is_starred? }
router.post("/:emailId/summary", summarizeLimiter, h(summarizeEmail)); // generate/return cached AI summary

export default router;
