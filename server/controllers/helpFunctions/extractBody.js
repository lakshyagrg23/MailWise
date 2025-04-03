export function extractBody(payload) {
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain') {
                return Buffer.from(part.body.data, 'base64').toString();
            }
            // Recursively check for nested parts
            if (part.parts) {
                const nestedBody = extractBody(part);
                if (nestedBody) return nestedBody;
            }
        }
    }
    return payload.body?.data ? Buffer.from(payload.body.data, 'base64').toString() : '';
}