import { Router } from "express"
import { sendEmails } from "../controllers/emails/sendEmails.js";
const router=Router();

router.post("/send-emails",sendEmails);


export default router;