import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { buildRawMessage } from '../../utils/mimeBuilder.js';
import dotenv from 'dotenv';
dotenv.config();

export const sendEmail = async (req, res) => {
    if (req.user.isDemo) {
        return res.status(200).json({ message: 'Email sent successfully', response: "success" });
    }

    try {
        const { gmail, user } = await getAuthenticatedClient({ userId: req.user.id });
        const senderID = user?.email || 'me';

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

        let base64Email;
        try {
            base64Email = buildRawMessage({ from: senderID, to, subject, body, reqBody: req.body });
        } catch (err) {
            if (err.isValidation) return res.status(400).json({ error: err.message });
            throw err;
        }

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: base64Email
            }
        });

        return res.status(200).json({ message: 'Email sent successfully', response: "success" });
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
};

export const sendEmails = sendEmail;
