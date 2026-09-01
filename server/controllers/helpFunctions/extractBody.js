/**
 * Recursively extracts plain text or HTML body from a Gmail payload,
 * handling Base64URL encoding and multipart hierarchies.
 *
 * @param {Object} payload - Gmail message payload
 * @returns {string} Decoded email body
 */
export function extractBody(payload) {
    if (!payload) return "";

    const decodeBase64 = (data) => {
        if (!data) return "";
        try {
            const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
            return Buffer.from(normalized, "base64").toString("utf-8");
        } catch {
            return "";
        }
    };

    // 1. First priority: look for text/plain across parts
    const findPlain = (part) => {
        if (part.mimeType === "text/plain" && part.body?.data) {
            return decodeBase64(part.body.data);
        }
        if (part.parts) {
            for (const sub of part.parts) {
                const res = findPlain(sub);
                if (res) return res;
            }
        }
        return null;
    };

    const plainBody = findPlain(payload);
    if (plainBody) return plainBody;

    // 2. Second priority: look for text/html across parts
    const findHtml = (part) => {
        if (part.mimeType === "text/html" && part.body?.data) {
            return decodeBase64(part.body.data);
        }
        if (part.parts) {
            for (const sub of part.parts) {
                const res = findHtml(sub);
                if (res) return res;
            }
        }
        return null;
    };

    const htmlBody = findHtml(payload);
    if (htmlBody) return htmlBody;

    // 3. Fallback: single-part body data
    return payload.body?.data ? decodeBase64(payload.body.data) : "";
}