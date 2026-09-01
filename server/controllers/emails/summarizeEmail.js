import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import prisma from '../../prisma.js';
import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { extractBody } from '../helpFunctions/extractBody.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * On-demand AI Summarization Controller.
 * Generates a rich, structured summary with action items and caches it in PostgreSQL.
 */
export const summarizeEmail = async (req, res) => {
    const { emailId } = req.params;
    const accessToken = req.headers.authorization?.split(" ")[1] || req.query.access_token;

    if (!emailId || !accessToken) {
        return res.status(400).json({ error: "Missing emailId or access_token" });
    }

    // 1. Handle Demo Account
    if (accessToken === "demo") {
        return res.json({
            email_id: emailId,
            summary: "• Welcome to the MailWise demo environment.\n• Key Action: Explore custom category filters, compose AI drafts, and test live summarization.\n• Status: Interactive preview mode.",
            isCached: true
        });
    }

    try {
        const { gmail, user } = await getAuthenticatedClient({ accessToken });
        const userId = user?.id;

        // 2. Check if a rich summary is already cached in PostgreSQL
        if (userId) {
            const existing = await prisma.emailMetadata.findUnique({
                where: {
                    user_id_email_id: {
                        user_id: userId,
                        email_id: emailId
                    }
                },
                select: { emailsummary: true }
            });

            // If summary exists and is longer than a snippet (or contains bullet points), return it immediately
            if (existing?.emailsummary && (existing.emailsummary.includes('•') || existing.emailsummary.length > 160)) {
                return res.json({
                    email_id: emailId,
                    summary: existing.emailsummary,
                    isCached: true
                });
            }
        }

        // 3. Fetch Full Email Content from Gmail API
        const msg = await gmail.users.messages.get({
            userId: 'me',
            id: emailId,
            format: 'full'
        });

        if (!msg?.data?.payload) {
            return res.status(404).json({ error: "Email content not found on Gmail" });
        }

        const headers = msg.data.payload.headers || [];
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
        const sender = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
        const rawBody = extractBody(msg.data.payload) || '';
        const cleanBody = rawBody.slice(0, 6000); // Send up to 6000 chars for deep summary

        // 4. Generate Rich AI Summary via Gemini
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const prompt = `
You are an executive email summarization assistant.
Analyze the following email and provide a clear, concise, and structured summary.

Email Subject: ${subject}
Sender: ${sender}
Body:
${cleanBody || "No body content."}

Instructions:
- Provide 2-3 crisp bullet points starting with "• " covering the core takeaway.
- Include a separate line "Action Item: <action or 'None'>" if any action/deadline is needed.
- Keep the entire summary under 60-80 words.
`.trim();

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiSummary = response.text().trim();

        // 5. Cache the AI Summary in PostgreSQL
        if (userId && aiSummary) {
            await prisma.emailMetadata.updateMany({
                where: {
                    user_id: userId,
                    email_id: emailId
                },
                data: {
                    emailsummary: aiSummary
                }
            }).catch(err => console.warn("[summarizeEmail] Failed to cache summary:", err.message));
        }

        return res.json({
            email_id: emailId,
            summary: aiSummary,
            isCached: false
        });

    } catch (error) {
        console.error("[summarizeEmail] Error generating summary:", error);
        return res.status(500).json({ error: "Failed to generate AI summary", details: error.message });
    }
};
