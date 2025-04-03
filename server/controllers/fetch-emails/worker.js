import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import pool from '../../db.js';  
import { extractBody } from '../helpFunctions/extractBody.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function fetchUserCategories(userId) {
    console.log(`userId is ${userId}`);
    try {
        let query = `SELECT category_name, category_description FROM category_preferences WHERE user_id = $1;`;
        const result = await pool.query(query, [userId]);
        // console.log(result.rows);
        return result.rows; // Returns an array of category objects
    } catch (error) {
        console.error("Error fetching user categories:", error);
        return []; // Return an empty array on failure
    }
}

async function processEmailWithGemini(userId, subject, body) {
    try {
        // Fetch user categories once
        const categories = await fetchUserCategories(userId);
        const categoryList = categories.length > 0 
            ? categories.map((cat, index) => `${index + 1}. ${cat.category_name} - ${cat.category_description}`).join("\n") 
            : "Miscellaneous";

        // Unified prompt for both classification & summary
        const PROMPT = `
You are an expert email assistant. Your task is to:
1. Classify the email into one of these categories:
   ${categoryList}
2. Generate a concise summary (30-40 words) of the email.

Email Subject: ${subject}
Email Body: ${body ? body : "No email body available."}

Return the response in the following JSON format (without Markdown or additional formatting):
{
    "category": "<CATEGORY_NAME>",
    "summary": "<SUMMARY_TEXT>"
}`;

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(PROMPT);
        const response = await result.response;
        
        // Ensure response text is retrieved properly
        const textResponse = await response.text();

        // Sanitize response to remove unwanted Markdown formatting
        const cleanedResponse = textResponse.replace(/```json|```/g, "").trim(); 

        // Parse response safely
        const jsonResponse = JSON.parse(cleanedResponse);

        return {
            emailCategory: jsonResponse.category || "Miscellaneous",
            summary: jsonResponse.summary || "Summary generation failed."
        };

    } catch (error) {
        console.error("Error processing email:", error);
        return {
            emailCategory: "Miscellaneous",
            summary: "Summary generation failed."
        };
    }
}

process.on("message",async({messages,userId,accessToken})=>{
    
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    let emails = [];

    for (const message of messages) {
        const msg = await gmail.users.messages.get({ userId: 'me', id: message.id });
        const attachName=msg.data.payload.parts && msg.data.payload.parts[1] &&  msg.data.payload.parts[1].body.attachmentId? msg.data.payload.parts[1].filename:"";

        const headers = msg.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const sender = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
        
        // Fetch email body correctly
        const body = extractBody(msg.data.payload);
        const receivedAt = new Date(parseInt(msg.data.internalDate)).toISOString();

        // Delay to respect API limits
        await delay(1000);

        // Classify email with Gemini AI
        const {emailCategory,summary} = await processEmailWithGemini(userId, subject, body);

        console.log(summary)

        // Store in database
        await pool.query(
            `INSERT INTO email_metadata (user_id, email_id, subject, sender, received_at, category, attachname,emailSummary)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (email_id) DO NOTHING`,
            [userId, message.id, subject, sender, receivedAt, emailCategory,attachName,summary]
        );

        emails.push({ email_id: message.id, subject, sender, body, category: emailCategory,attachname:attachName, emailsummary:summary});
        
    }

    process.send(emails)

    process.exit(0);
})
