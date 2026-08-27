import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateAiEmail = async (req, res) => {
    const { type = 'formal', details } = req.query;

    if (!details) {
        return res.status(400).json({ error: "Missing required query parameter: details" });
    }

    try {
        const PROMPT = `
        You are an expert email writing assistant. Your task is to:
        
        1. Carefully understand the purpose and context of the email from the description.
        2. Generate a highly relevant and professional subject line that clearly reflects the purpose.
        3. Write a complete email body that is appropriate for the given type (formal or informal), and fully aligned with the description provided.
        
        Guidelines:
        - Use formal tone and structure if the type is "formal", otherwise keep the tone casual for "informal".
        - Ensure the email addresses the context in detail, and sounds human-written, not robotic.
        - Include a greeting, main body, and a suitable closing.
        - Keep the email concise yet complete, typically 100-150 words.
        
        Email Type: ${type}
        Description: ${details}
        
        Return the response strictly in the following JSON format:
        {
          "subject": "<EMAIL_SUBJECT>",
          "body": "<EMAIL_BODY>"
        }
        `;

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(PROMPT);
        const response = await result.response;
        const textResponse = await response.text();
        const cleanedResponse = textResponse.replace(/```json|```/g, "").trim();
        const jsonResponse = JSON.parse(cleanedResponse);

        return res.status(200).json({
            subject: jsonResponse.subject || "No Subject",
            body: jsonResponse.body || "No Body"
        });
    } catch (error) {
        console.error("Error processing email with Gemini:", error);
        return res.status(500).json({
            error: "Failed to generate email with Gemini",
            details: error.message
        });
    }
};

export const aiEmail = generateAiEmail;
