import { Router } from "express";
import { asyncHandler as h } from "../../utils/http/asyncHandler.js";
import { DRAFT_ID_RE, validateParam } from "../../utils/http/params.js";
import { listDrafts, getDraft, createDraft, updateDraft, deleteDraft } from "../../controllers/drafts/drafts.js";

const router = Router();

router.param("draftId", validateParam(DRAFT_ID_RE, "Invalid draft ID"));

router.get("/", h(listDrafts));
router.post("/", h(createDraft));
router.get("/:draftId", h(getDraft));
router.put("/:draftId", h(updateDraft));
router.delete("/:draftId", h(deleteDraft));

export default router;
