import { google } from 'googleapis';
import prisma from '../../prisma.js';
import dotenv from 'dotenv';
import { data } from '../helpFunctions/fetchUserData.js';
dotenv.config();

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

export const sendEmails=async (req,res)=>{
    const accessToken=req.body.params.access_token;

    if (accessToken === "demo") {
        return res.status(200).json({ message: 'Email sent successfully', response: "success" });
    }

    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    const googleId=await data(accessToken);

    auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
    });

    auth.setCredentials({
        access_token: accessToken,
    });
    const user = await prisma.user.findUnique({
        where: { google_id: googleId },
        select: { email: true }
    });
    const senderID=user.email;
    const gmail = google.gmail({version: 'v1', auth});
    try{
        const rawBody=req.body.body;
        const { to, subject, body } = JSON.parse(rawBody);
        console.log(to)
        console.log(JSON.parse(rawBody));
        const emailLines = [
            `From: ${senderID}`,
            `To:${to}`,
            'Content-type: text/html;charset=iso-8859-1',
            'MIME-Version: 1.0',
            `Subject: ${subject}`,
            '',
            `${body}`
        ];
        const email = emailLines.join('\r\n').trim();
        const base64Email = Buffer.from(email)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
            raw: base64Email
            }
        });
        res.status(200).json({ message: 'Email sent successfully',response:"success"});
    }
    catch(error){
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
};