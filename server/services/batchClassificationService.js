import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { asyncPool } from '../utils/asyncPool.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_BATCH_TOKENS = 8000;

/**
 * Estimates the token count of an email object using a standard character heuristic (~4 chars/token).
 *
 * @param {Object} email
 * @returns {number}
 */
export function estimateEmailTokens(email) {
    const subjectLength = (email.subject || '').length;
    const senderLength = (email.sender || '').length;
    const bodyLength = (email.body || '').length;
    return Math.ceil((subjectLength + senderLength + bodyLength + 120) / 4);
}

/**
 * Groups an array of emails into token-budgeted batches so that no single batch exceeds maxTokens.
 *
 * @param {Array} emails - Array of raw email objects
 * @param {number} [maxTokens=8000] - Maximum estimated tokens per batch
 * @returns {Array<Array>} Array of batches
 */
export function createTokenBatches(emails, maxTokens = MAX_BATCH_TOKENS) {
    if (!Array.isArray(emails) || emails.length === 0) {
        return [];
    }

    const batches = [];
    let currentBatch = [];
    let currentTokens = 0;

    for (const email of emails) {
        const emailTokens = estimateEmailTokens(email);

        // If adding this email exceeds the budget, close the current batch and start a new one
        if (currentBatch.length > 0 && (currentTokens + emailTokens > maxTokens)) {
            batches.push(currentBatch);
            currentBatch = [];
            currentTokens = 0;
        }

        currentBatch.push(email);
        currentTokens += emailTokens;
    }

    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }

    return batches;
}

/**
 * Builds a structured, delimited batch prompt containing all emails in the batch and user categories.
 *
 * @param {Array} emails - Batch of emails
 * @param {Array} categories - Array of category preference objects
 * @returns {string} Formatted prompt string
 */
export function buildBatchPrompt(emails, categories) {
    const categoryList = categories && categories.length > 0
        ? categories.map((cat, idx) => `${idx + 1}. ${cat.category_name} - ${cat.category_description}`).join("\n")
        : "1. Miscellaneous - Everything else.";

    const formattedEmails = emails.map(email => `
<email id="${email.email_id}">
Subject: ${email.subject || "No Subject"}
Sender: ${email.sender || "Unknown Sender"}
Body:
${email.body || "No email body available."}
</email>`).join("\n");

    return `
You are an expert email assistant. Your task is to process the following batch of emails.

Available Categories:
${categoryList}

Instructions:
1. For each email provided below inside <email id="...">...</email>, classify it into exactly one of the Available Categories.
2. Generate a concise, professional summary (30-40 words) highlighting the purpose and key details.
3. Use the exact email id provided in each <email> tag.

Emails to process:
${formattedEmails}

Return STRICTLY a JSON array matching the following schema with no extra commentary:
[
  {
    "email_id": "<EXACT_EMAIL_ID>",
    "category": "<CATEGORY_NAME>",
    "summary": "<30-40 word concise summary>"
  }
]
`.trim();
}

/**
 * Resolves a safe default category for fallbacks when AI fails or omits an email.
 * Priority:
 * 1. An existing category named "Miscellaneous", "Other", or "General" (case-insensitive).
 * 2. The user's first available category.
 * 3. Final fallback: "Miscellaneous".
 *
 * @param {Array} categories - User category preferences
 * @returns {string} Safe default category name
 */
export function resolveDefaultCategory(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
        return "Miscellaneous";
    }
    const match = categories.find(c => {
        const name = (c.category_name || '').toLowerCase().trim();
        return name === "miscellaneous" || name === "other" || name === "general";
    });
    return match ? match.category_name : (categories[0]?.category_name || "Miscellaneous");
}

/**
 * Creates a safe fallback email record when classification fails or an email is omitted.
 *
 * @param {Object} email - Raw email object
 * @param {string} defaultCategory - Fallback category name
 * @returns {Object} Full email record ready for insertion
 */
export function createFallbackEmailRecord(email, defaultCategory) {
    return {
        email_id: email.email_id,
        subject: email.subject || "No Subject",
        sender: email.sender || "Unknown Sender",
        category: defaultCategory,
        emailsummary: email.body
            ? email.body.slice(0, 150).replace(/\s+/g, ' ') + '...'
            : "No summary available.",
        attachname: email.attachName || null,
        received_date: email.receivedAt ? new Date(email.receivedAt) : new Date(),
        update: 1n
    };
}

/**
 * Classifies a single batch of emails using Gemini 2.5 Flash and reconciles output back to input emails.
 * Guarantees zero dropped emails by falling back safely if an ID is omitted.
 *
 * @param {Array} batch - Batch of email objects
 * @param {Array} categories - User categories
 * @returns {Promise<Array>} Classified email records
 */
export async function classifySingleBatch(batch, categories) {
    if (!Array.isArray(batch) || batch.length === 0) {
        return [];
    }

    // Build category lookup map (case-insensitive)
    const validCategoryMap = new Map();
    (categories || []).forEach(cat => {
        validCategoryMap.set(cat.category_name.toLowerCase().trim(), cat.category_name);
    });

    const defaultCategory = resolveDefaultCategory(categories);

    const prompt = buildBatchPrompt(batch, categories);
    const resultsMap = new Map();

    try {
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        // Strip any markdown code fence wrappers if present
        const cleanedJson = text.replace(/^```json/i, '').replace(/```$/i, '').trim();
        const parsedArray = JSON.parse(cleanedJson);

        if (Array.isArray(parsedArray)) {
            parsedArray.forEach(item => {
                if (item?.email_id) {
                    resultsMap.set(item.email_id, item);
                }
            });
        }
    } catch (err) {
        console.error("[batchClassificationService] Gemini batch classification failed, falling back safely:", err.message);
    }

    // Reconcile output 1:1 with input batch to ensure zero lost emails
    return batch.map(email => {
        const aiResult = resultsMap.get(email.email_id);
        let category = defaultCategory;

        if (aiResult?.category) {
            const matched = validCategoryMap.get(aiResult.category.toLowerCase().trim());
            if (matched) {
                category = matched;
            }
        }

        const summary = aiResult?.summary && aiResult.summary.trim().length > 0
            ? aiResult.summary.trim()
            : (email.body ? email.body.slice(0, 150).replace(/\s+/g, ' ') + '...' : "No summary available.");

        return {
            email_id: email.email_id,
            subject: email.subject || "No Subject",
            sender: email.sender || "Unknown Sender",
            category: category,
            emailsummary: summary,
            attachname: email.attachName || null,
            received_date: email.receivedAt ? new Date(email.receivedAt) : new Date(),
            update: 1n
        };
    });
}

/**
 * Concurrently processes multiple token-aware batches with Gemini using controlled concurrency.
 *
 * @param {Array<Array>} batches - Array of email batches
 * @param {Array} categories - User categories
 * @param {number} [concurrency=2] - Maximum simultaneous active Gemini calls
 * @returns {Promise<Array>} Flat array of all classified email records
 */
export async function classifyAllBatchesConcurrently(batches, categories, concurrency = 2) {
    if (!Array.isArray(batches) || batches.length === 0) {
        return [];
    }

    const defaultCategory = resolveDefaultCategory(categories);

    console.log(`[batchClassificationService] Classifying ${batches.length} batches with Gemini concurrency limit ${concurrency}...`);

    const settledResults = await asyncPool(concurrency, batches, async (batch, batchIndex) => {
        console.log(`[batchClassificationService] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} emails)...`);
        return classifySingleBatch(batch, categories);
    });

    const classifiedEmails = [];
    settledResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            classifiedEmails.push(...result.value);
        } else {
            console.error(`[batchClassificationService] Batch ${idx + 1} completely failed:`, result.reason);
            // Fallback for the failed batch using the shared category resolution
            const fallbackBatch = batches[idx].map(email => createFallbackEmailRecord(email, defaultCategory));
            classifiedEmails.push(...fallbackBatch);
        }
    });

    console.log(`[batchClassificationService] Successfully classified ${classifiedEmails.length} total emails across ${batches.length} batches.`);
    return classifiedEmails;
}
