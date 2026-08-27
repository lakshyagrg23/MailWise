import { google } from 'googleapis';
import prisma from '../../prisma.js';
import dotenv from 'dotenv';
import { data } from '../helpFunctions/fetchUserData.js';
dotenv.config();

export const sendEmails = async (req, res) => {
    const accessToken = req.headers.authorization?.split(' ')[1]
        || req.body?.params?.access_token
        || req.body?.access_token
        || req.query?.access_token;

    if (!accessToken) {
        return res.status(401).json({ error: "Missing access token" });
    }

    if (accessToken === "demo") {
        return res.status(200).json({ message: 'Email sent successfully', response: "success" });
    }

    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        auth.setCredentials({ access_token: accessToken });

        let senderID = 'me';
        try {
            const googleId = await data(accessToken);
            const user = await prisma.user.findUnique({
                where: { google_id: googleId },
                select: { email: true }
            });
            if (user?.email) {
                senderID = user.email;
            }
        } catch (authErr) {
            console.warn("Could not determine user email, falling back to 'me':", authErr.message);
        }

        const gmail = google.gmail({ version: 'v1', auth });

        // Handle both stringified body (legacy frontend Compose.jsx) and standard JSON payload
        let to = req.body?.to;
        let subject = req.body?.subject || '';
        let body = req.body?.body || '';

        if (typeof req.body?.body === 'string') {
            try {
                const parsed = JSON.parse(req.body.body);
                to = parsed.to || to;
                subject = parsed.subject !== undefined ? parsed.subject : subject;
                body = parsed.body !== undefined ? parsed.body : body;
            } catch {
                // If it's not JSON, treat req.body.body as the raw body string
            }
        } else if (req.body?.body && typeof req.body.body === 'object') {
            to = req.body.body.to || to;
            subject = req.body.body.subject !== undefined ? req.body.body.subject : subject;
            body = req.body.body.body !== undefined ? req.body.body.body : body;
        }

        if (!to) {
            return res.status(400).json({ error: "Recipient ('to') is required" });
        }

        const emailLines = [
            `From: ${senderID}`,
            `To: ${to}`,
            'Content-Type: text/html; charset="UTF-8"',
            'MIME-Version: 1.0',
            `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
            '',
            `${body}`
        ];
        const email = emailLines.join('\r\n').trim();
        const base64Email = Buffer.from(email, 'utf-8')
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

        return res.status(200).json({ message: 'Email sent successfully', response: "success" });
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
};