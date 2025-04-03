import { Router } from "express"
import { fetch3 } from "../controllers/fetch-emails/fetch3.js";
const router=Router();

router.get("/:userId",fetch3) //fetch body


export default router;