/**
 * Email Preprocessing & Cleaning Utility for AI Prompts.
 *
 * Cleans raw email bodies by:
 * 1. Stripping HTML tags, styles, scripts, and decoding HTML entities.
 * 2. Removing quoted reply chains ("On ... wrote:", forwarded messages, "> blockquotes").
 * 3. Pruning email signatures ("Sent from my iPhone", "-- ", sign-offs).
 * 4. Removing compliance disclaimers and unsubscribe footers.
 * 5. Normalizing whitespace and truncating to high-signal tokens.
 */

/**
 * Decodes common HTML entities into plain text.
 * @param {string} text 
 * @returns {string}
 */
export function decodeHtmlEntities(text) {
    if (!text) return "";
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&#x2F;/gi, "/")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

/**
 * Converts raw HTML into clean, human-readable plain text.
 * @param {string} html 
 * @returns {string}
 */
export function stripHtml(html) {
    if (!html || typeof html !== "string") return "";

    let text = html;

    // 1. Remove <head>, <style>, <script>, <svg>, <noscript> blocks completely
    text = text.replace(/<head[\s\S]*?<\/head>/gi, " ");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
    text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
    text = text.replace(/<svg[\s\S]*?<\/svg>/gi, " ");
    text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
    text = text.replace(/<!--[\s\S]*?-->/g, " ");

    // 2. Convert block elements and line breaks to newlines
    text = text.replace(/<\/(div|p|tr|li|h[1-6]|table|section|article)>/gi, "\n");
    text = text.replace(/<br\s*[\/]?>/gi, "\n");
    text = text.replace(/<hr\s*[\/]?>/gi, "\n");

    // 3. Strip all remaining HTML tags
    text = text.replace(/<[^>]+>/g, " ");

    // 4. Decode HTML entities
    text = decodeHtmlEntities(text);

    return text;
}

/**
 * Strips quoted reply chains from an email body to isolate the primary message.
 * @param {string} text 
 * @returns {string}
 */
export function stripQuotedReplies(text) {
    if (!text) return "";

    let cleaned = text;

    // Pattern 1: Standard forwarded / original message separator
    cleaned = cleaned.replace(/(?:^|\n)\s*-{3,}\s*(?:Original|Forwarded)\s*Message\s*-{3,}[\s\S]*/i, "");

    // Pattern 2: "On [Date/Time], [Name] wrote:"
    cleaned = cleaned.replace(/(?:^|\n)\s*On\s+[^\n]+?wrote:\s*[\s\S]*/i, "");

    // Pattern 3: Outlook-style header blocks
    cleaned = cleaned.replace(/(?:^|\n)\s*From:\s+[^\n]+\n(?:Sent|Date):\s+[^\n]+[\s\S]*/i, "");

    // Pattern 4: Strip leading blockquote lines ("> Quote")
    cleaned = cleaned
        .split("\n")
        .filter(line => !line.trim().startsWith(">"))
        .join("\n");

    return cleaned;
}

/**
 * Prunes common email signatures, mobile footers, and legal confidentiality disclaimers.
 * @param {string} text 
 * @returns {string}
 */
export function stripSignaturesAndFooters(text) {
    if (!text) return "";

    let cleaned = text;

    // 1. Standard RFC 3676 signature delimiter: "-- \n"
    cleaned = cleaned.replace(/(?:^|\n)\s*--\s*(\n[\s\S]*)?$/, "");

    // 2. Mobile device signatures
    cleaned = cleaned.replace(/(?:^|\n)\s*(?:Sent from my (?:iPhone|iPad|Galaxy|Android|mobile device)|Get Outlook for (?:iOS|Android)|Sent from Mail for Windows)[\s\S]*/i, "");

    // 3. Unsubscribe & Marketing boilerplates
    cleaned = cleaned.replace(/(?:^|\n)\s*(?:If you no longer wish to receive these emails|To unsubscribe from these updates|Click here to unsubscribe|You are receiving this email because|Unsubscribe\s*\|)[\s\S]*/i, "");

    // 4. Standard corporate confidentiality notices
    cleaned = cleaned.replace(/(?:^|\n)\s*(?:This e-mail and any attachments are confidential|The information contained in this message is intended solely for|CONFIDENTIALITY NOTICE:[\s\S]*?|This email is confidential and may contain privileged)[\s\S]*/i, "");

    return cleaned;
}

/**
 * Master preprocessing pipeline for AI ingestion.
 * Cleans HTML, strips replies, removes disclaimers, collapses whitespace,
 * and limits character length to high-signal tokens.
 *
 * @param {string} rawBody - Raw body text or HTML
 * @param {number} [maxChars=1200] - Max character cap for AI input (default ~300 tokens)
 * @returns {string} Clean, high-density plain text
 */
export function cleanEmailForAI(rawBody, maxChars = 1200) {
    if (!rawBody || typeof rawBody !== "string") {
        return "";
    }

    // Step 1: Detect if content is HTML and strip tags/entities
    let text = rawBody;
    if (/<[a-z][\s\S]*>/i.test(text)) {
        text = stripHtml(text);
    }

    // Step 2: Strip quoted replies and forward histories
    text = stripQuotedReplies(text);

    // Step 3: Strip signatures, mobile tags, and legal footers
    text = stripSignaturesAndFooters(text);

    // Step 4: Normalize whitespace
    text = text
        .split("\n")
        .map(line => line.trim().replace(/[ \t]+/g, " "))
        .filter(line => line.length > 0)
        .join("\n");

    // Fallback if cleaning stripped too aggressively
    if (!text.trim()) {
        text = stripHtml(rawBody).replace(/\s+/g, " ").trim();
    }

    // Step 5: Truncate to token-budgeted character length
    if (text.length > maxChars) {
        text = text.slice(0, maxChars) + "...";
    }

    return text.trim();
}
