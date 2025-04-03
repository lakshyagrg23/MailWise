import { google } from 'googleapis';
import pool from '../../db.js';  
import dotenv from 'dotenv';
import { data } from '../helpFunctions/fetchUserData.js';
dotenv.config();

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Create Gmail client
const gmail = google.gmail({version: 'v1', auth});

export const sendEmails=async (req,res)=>{
    const accessToken=req.body.params.access_token;
    const googleId=await data(accessToken);
    // const useremail = await pool.query("SELECT id, email FROM users WHERE google_id = $1", [googleId]);
    // // console.log(useremail)
    try{
        console.log(req.body);
        const emailLines = [
            'From: tarang23100@iiitnr.edu.in',
            `To: ${req.body.to}`,
            'Content-type: text/html;charset=iso-8859-1',
            'MIME-Version: 1.0',
            `Subject: ${req.body.subject}`,
            '',
            `${req.body.body}`
        ];
        const email = emailLines.join('\r\n').trim();
        const base64Email = Buffer.from(email).toString('base64');
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
            raw: base64Email
            }
        });
        res.status(200).json({ message: 'Email sent successfully', response });
    }
    catch(error){
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
};