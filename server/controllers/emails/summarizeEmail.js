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
    let accessToken = req.headers.authorization?.split(" ")[1] || req.query.access_token;
    if (accessToken === 'undefined' || accessToken === 'null') accessToken = null;
    const queryUserId = req.query.user_id;

    if (!emailId || (!accessToken && !queryUserId)) {
        return res.status(400).json({ error: "Missing emailId or authentication credentials" });
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
        const { gmail, user } = await getAuthenticatedClient({ accessToken, userId: queryUserId });
        const userId = user?.id || (queryUserId ? parseInt(queryUserId) : null);

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

            // If summary exists and is a structured rich summary, return it immediately
            if (existing?.emailsummary && (existing.emailsummary.includes('•') || existing.emailsummary.includes('Action Item') || existing.emailsummary.length > 160)) {
                return res.json({
                    email_id: emailId,
                    summary: existing.emailsummary,
                    isCached: true
                });
            }
        }

        // 3. Fetch Email Content from Gmail API with fallback to PostgreSQL snippet
        let subject = 'No Subject';
        let sender = 'Unknown Sender';
        let cleanBody = '';

        try {
            if (gmail) {
                const msg = await gmail.users.messages.get({
                    userId: 'me',
                    id: emailId,
                    format: 'full'
                });

                if (msg?.data?.payload) {
                    const headers = msg.data.payload.headers || [];
                    subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || subject;
                    sender = headers.find(h => h.name.toLowerCase() === 'from')?.value || sender;
                    const rawBody = extractBody(msg.data.payload) || '';
                    cleanBody = rawBody.slice(0, 6000);
                }
            }
        } catch (gmailFetchErr) {
            console.warn(`[summarizeEmail] Gmail fetch fallback for ${emailId}:`, gmailFetchErr.message);
            if (userId) {
                const dbFallback = await prisma.emailMetadata.findUnique({
                    where: { user_id_email_id: { user_id: userId, email_id: emailId } }
                });
                if (dbFallback) {
                    subject = dbFallback.subject || subject;
                    sender = dbFallback.sender || sender;
                    cleanBody = dbFallback.emailsummary || '';
                }
            }
        }

        // 4. Generate Rich AI Summary via Gemini 2.5 Flash
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
