import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { asyncPool } from '../utils/asyncPool.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_BATCH_TOKENS = 8000;

/**
 * Generates a clean single-line snippet from the email body.
 *
 * @param {string} body
 * @param {number} [maxChars=140]
 * @returns {string}
 */
export function generateBodySnippet(body, maxChars = 140) {
    if (!body || body.trim().length === 0) {
        return "No preview available.";
    }
    const clean = body.replace(/\s+/g, ' ').trim();
    return clean.length > maxChars ? clean.slice(0, maxChars) + '...' : clean;
}

/**
 * Estimates the token count of an email object (~4 chars/token).
 *
 * @param {Object} email
 * @returns {number}
 */
export function estimateEmailTokens(email) {
    const subjectLength = (email.subject || '').length;
    const senderLength = (email.sender || '').length;
    const bodyLength = (email.body || '').length;
    return Math.ceil((subjectLength + senderLength + bodyLength + 100) / 4);
}

/**
 * Pre-sorts emails by Gmail System Labels (SPAM, Promotions, Social)
 * to bypass Gemini entirely for zero token cost and instant routing.
 *
 * @param {Array} emails - Array of raw email objects with labelIds
 * @returns {{ directBucketEmails: Array, aiTargetEmails: Array }}
 */
export function splitSystemAndAiEmails(emails) {
    const directBucketEmails = [];
    const aiTargetEmails = [];

    for (const email of emails) {
        const labels = email.labelIds || [];
        if (labels.includes('SPAM')) {
            directBucketEmails.push({
                email_id: email.email_id,
                subject: email.subject || "No Subject",
                sender: email.sender || "Unknown Sender",
                category: "Spam",
                emailsummary: generateBodySnippet(email.body),
                attachname: email.attachName || null,
                received_date: email.receivedAt ? new Date(email.receivedAt) : new Date(),
                update: 1n
            });
        } else if (labels.includes('CATEGORY_PROMOTIONS')) {
            directBucketEmails.push({
                email_id: email.email_id,
                subject: email.subject || "No Subject",
                sender: email.sender || "Unknown Sender",
                category: "Promotions",
                emailsummary: generateBodySnippet(email.body),
                attachname: email.attachName || null,
                received_date: email.receivedAt ? new Date(email.receivedAt) : new Date(),
                update: 1n
            });
        } else if (labels.includes('CATEGORY_SOCIAL')) {
            directBucketEmails.push({
                email_id: email.email_id,
                subject: email.subject || "No Subject",
                sender: email.sender || "Unknown Sender",
                category: "Social",
                emailsummary: generateBodySnippet(email.body),
                attachname: email.attachName || null,
                received_date: email.receivedAt ? new Date(email.receivedAt) : new Date(),
                update: 1n
            });
        } else {
            // Primary inbox, Updates, and unlabelled mail go to Gemini for smart classification
            aiTargetEmails.push(email);
        }
    }

    return { directBucketEmails, aiTargetEmails };
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
 * Builds a fast, category-only batch prompt requesting ONLY email_id and category.
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
You are an expert email classification assistant. Your task is to quickly classify the following emails into the Available Categories.

Available Categories:
${categoryList}

Instructions:
1. For each email provided below inside <email id="...">...</email>, assign it to the single best matching Category from the Available Categories list.
2. Return STRICTLY a JSON array of objects with the exact schema:
[
  {
    "email_id": "<EXACT_EMAIL_ID>",
    "category": "<CATEGORY_NAME>"
  }
]

Emails to process:
${formattedEmails}
`.trim();
}

/**
 * Resolves a safe default category for fallbacks when AI fails or omits an email.
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
        emailsummary: generateBodySnippet(email.body),
        attachname: email.attachName || null,
        received_date: email.receivedAt ? new Date(email.receivedAt) : new Date(),
        update: 1n
    };
}

/**
 * Classifies a single batch of emails with Gemini (Category-only, ultra-fast).
 *
 * @param {Array} batch - Batch of email objects
 * @param {Array} categories - User categories
 * @returns {Promise<Array>} Classified email records
 */
export async function classifySingleBatch(batch, categories) {
    if (!Array.isArray(batch) || batch.length === 0) {
        return [];
    }

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

    return batch.map(email => {
        const aiResult = resultsMap.get(email.email_id);
        let category = defaultCategory;

        if (aiResult?.category) {
            const matched = validCategoryMap.get(aiResult.category.toLowerCase().trim());
            if (matched) {
                category = matched;
            }
        }

        return {
            email_id: email.email_id,
            subject: email.subject || "No Subject",
            sender: email.sender || "Unknown Sender",
            category: category,
            emailsummary: generateBodySnippet(email.body),
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

    const settledResults = await asyncPool(concurrency, batches, async (batch, batchIndex) => {
        return classifySingleBatch(batch, categories);
    });

    const classifiedEmails = [];
    settledResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            classifiedEmails.push(...result.value);
        } else {
            console.error(`[batchClassificationService] Batch ${idx + 1} completely failed:`, result.reason);
            const fallbackBatch = batches[idx].map(email => createFallbackEmailRecord(email, defaultCategory));
            classifiedEmails.push(...fallbackBatch);
        }
    });

    return classifiedEmails;
}

/**
 * Top-level processor: Separates zero-cost system buckets (Spam/Promotions/Social)
 * and classifies remaining Primary/Updates emails with Gemini.
 *
 * @param {Array} rawEmails - Array of raw emails from Gmail
 * @param {Array} categories - User categories
 * @param {number} [concurrency=2] - Gemini concurrency limit
 * @returns {Promise<Array>} Full list of classified emails
 */
export async function processAndClassifyEmails(rawEmails, categories, concurrency = 2) {
    if (!Array.isArray(rawEmails) || rawEmails.length === 0) {
        return [];
    }

    // 1. Fast-path routing based on Gmail System Labels
    const { directBucketEmails, aiTargetEmails } = splitSystemAndAiEmails(rawEmails);
    console.log(`[batchClassificationService] Fast-path System Emails (0 AI Tokens): ${directBucketEmails.length} | AI Classification Targets: ${aiTargetEmails.length}`);

    let classifiedAiEmails = [];
    if (aiTargetEmails.length > 0) {
        const batches = createTokenBatches(aiTargetEmails, MAX_BATCH_TOKENS);
        classifiedAiEmails = await classifyAllBatchesConcurrently(batches, categories, concurrency);
    }

    return [...directBucketEmails, ...classifiedAiEmails];
}
