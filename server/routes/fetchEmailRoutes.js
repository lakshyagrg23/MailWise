import { Router } from "express"
import { fetch1 } from '../controllers/fetch-emails/fetch1.js';
import { fetch2 } from "../controllers/fetch-emails/fetch2.js";

const router=Router();

router.get("/:category",fetch1) //fetch emails by category
router.get("/:email_id",fetch2) // Fetch single email by ID


export default router;