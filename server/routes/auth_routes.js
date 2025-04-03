import { Router } from "express"
import { google } from 'googleapis';
import dotenv from 'dotenv';
import {url} from "../controllers/auth/url.js"
import { callback } from "../controllers/auth/callback.js";

dotenv.config();

const router=Router();
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

router.get("/url", (req, res) => url(oauth2Client)(req, res));
router.get("/callback", (req, res) => callback(oauth2Client)( req, res));


export default router;