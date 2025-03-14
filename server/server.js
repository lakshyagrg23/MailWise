import express from 'express';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Generate OAuth consent URL
app.get('/auth/url', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    });
    res.json({ authUrl });
});

// Handle OAuth callback
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    const accessToken = tokens.access_token;
    res.redirect(`http://localhost:3000?access_token=${accessToken}`);
});

// Fetch emails by category
app.get('/fetch-emails/:category', async (req, res) => {
    const accessToken = req.query.access_token;
    const category = req.params.category;

    if (!accessToken) {
        return res.status(401).send("Unauthorized: Missing access token");
    }

    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: authClient });

    let messages = [];

    try {
        const response = await gmail.users.messages.list({ userId: 'me', maxResults: 15 });
        console.log(response.data.messages);
        messages = response.data.messages || [];
    } catch (error) {
        console.error('Failed to fetch emails:', error);
        return res.status(500).send("Error fetching emails from Gmail");
    }

    const emails = [];

    for (const message of messages) {
        const msg = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
        });

        const headers = msg.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const sender = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
        const body = extractBody(msg.data.payload);

        await delay(1000);

        const emailCategory = await classifyEmailWithGemini(subject, body);
        if(category==='All'){
            emails.push({ subject, sender, body, category: emailCategory });
        }
        else if (emailCategory.toLowerCase() === category.toLowerCase()) {
            emails.push({ subject, sender, body, category: emailCategory });
        }
    }

    res.json({ emails });
});

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function extractBody(payload) {
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain') {
                return Buffer.from(part.body.data, 'base64').toString();
            }
        }
    }
    return payload.body?.data ? Buffer.from(payload.body.data, 'base64').toString() : '';
}

async function classifyEmailWithGemini(subject, body) {
    try{
    const CATEGORY_PROMPT = `
You are an expert email classification assistant. Your task is to read the email below and classify it into one of these categories:

1. Essential - Important career, academic, or life updates such as job offers, exam schedules, etc.
2. Social - Personal communications and social media notifications.
3. Promotions - Marketing, sales, and product launch announcements.
4. Updates - Order status, service updates, or time-sensitive event notifications.
5. Finance - Banking, billing, investment updates.
6. Subscriptions - Regular newsletters, content updates from subscribed services.
7. Miscellaneous - Everything else.

Email Subject: ${subject}
Email Body: ${body}

Return only the category name.
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(CATEGORY_PROMPT);
    const response = await result.response;
    return response.text().trim();
    } catch (error) {
        console.error('Gemini Classification Failed:', error);
        return "Miscellaneous";  // Fallback
    }
}

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
