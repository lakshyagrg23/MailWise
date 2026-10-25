// Hand-built, injection-safe MIME message construction for Gmail "raw" sends.

export const MAX_RECIPIENTS = 50;
export const MAX_SUBJECT_LENGTH = 998;
export const MAX_BODY_BYTES = 1024 * 1024;

export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.isValidation = true;
        this.status = 400;
    }
}

const CTRL_RE = /[\r\n\0]/;
const ATOM = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const ADDR_RE = new RegExp(`^${ATOM}(?:\\.${ATOM})*@${LABEL}(?:\\.${LABEL})+$`);
const NAMED_RE = /^\s*([^<>"\\,;:@\x00-\x1f\x7f]*?)\s*<([^<>\s]+)>\s*$/;

const asString = (value, field) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') throw new ValidationError(`'${field}' must be a string`);
    if (CTRL_RE.test(value)) throw new ValidationError(`'${field}' contains illegal control characters`);
    return value;
};

const b64 = (s) => Buffer.from(s, 'utf-8').toString('base64');

// RFC 2047 encoded-word(s); chunked by code point so each word stays <= 75 chars.
const encodeWords = (text) => {
    const words = [];
    let chunk = '';
    for (const ch of text) {
        if (Buffer.byteLength(chunk + ch, 'utf-8') > 45) {
            words.push(chunk);
            chunk = '';
        }
        chunk += ch;
    }
    if (chunk || !words.length) words.push(chunk);
    return words.map((w) => `=?UTF-8?B?${b64(w)}?=`).join('\r\n ');
};

export function validateRecipients(value, field, { required = false } = {}) {
    const str = asString(value, field);
    if (!str.trim()) {
        if (required) throw new ValidationError(`Recipient ('${field}') is required`);
        return [];
    }
    const parts = str.split(',').map((p) => p.trim());
    if (parts.some((p) => !p)) throw new ValidationError(`'${field}' contains an empty recipient`);
    if (parts.length > MAX_RECIPIENTS) {
        throw new ValidationError(`Too many recipients in '${field}' (max ${MAX_RECIPIENTS})`);
    }
    return parts.map((part) => {
        let name = '';
        let addr = part;
        const m = NAMED_RE.exec(part);
        if (m) {
            name = m[1].trim();
            addr = m[2];
        }
        if (addr.length > 254 || !ADDR_RE.test(addr)) {
            throw new ValidationError(`Invalid email address in '${field}'`);
        }
        return name ? `${encodeWords(name)} <${addr}>` : addr;
    });
}

// Pull optional cc/bcc out of any of the supported request shapes.
const extractExtra = (reqBody, key) => {
    if (!reqBody || typeof reqBody !== 'object') return undefined;
    let v = reqBody[key];
    const inner = reqBody.body;
    if (typeof inner === 'string') {
        try {
            const parsed = JSON.parse(inner);
            if (parsed && typeof parsed === 'object' && parsed[key] !== undefined) v = parsed[key];
        } catch { /* raw body string */ }
    } else if (inner && typeof inner === 'object' && inner[key] !== undefined) {
        v = inner[key];
    }
    return v;
};

const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n').trimEnd();

/**
 * Validate input and return a base64url Gmail `raw` message.
 * `from` must be the authenticated user's email (never request data).
 * Throws ValidationError (status 400) on bad input.
 */
export function buildRawMessage({ from, to, subject, body, reqBody }) {
    const toList = validateRecipients(to, 'to', { required: true });
    const ccList = validateRecipients(extractExtra(reqBody, 'cc'), 'cc');
    const bccList = validateRecipients(extractExtra(reqBody, 'bcc'), 'bcc');
    if (toList.length + ccList.length + bccList.length > MAX_RECIPIENTS) {
        throw new ValidationError(`Too many recipients (max ${MAX_RECIPIENTS})`);
    }

    const subj = asString(subject, 'subject');
    if (subj.length > MAX_SUBJECT_LENGTH) {
        throw new ValidationError(`Subject too long (max ${MAX_SUBJECT_LENGTH} characters)`);
    }

    let html = body === undefined || body === null ? '' : body;
    if (typeof html !== 'string') throw new ValidationError("'body' must be a string");
    if (Buffer.byteLength(html, 'utf-8') > MAX_BODY_BYTES) {
        throw new ValidationError('Body too large');
    }

    // From is server-side only; reject anything unusable rather than emit a bad header.
    let fromAddr = typeof from === 'string' ? from.trim() : '';
    if (fromAddr === 'me') fromAddr = ''; // Gmail fills in the authenticated account
    if (fromAddr && (CTRL_RE.test(fromAddr) || !ADDR_RE.test(fromAddr))) {
        throw new ValidationError('Invalid sender address');
    }

    const headers = [];
    if (fromAddr) headers.push(`From: ${fromAddr}`);
    headers.push(`To: ${toList.join(',\r\n ')}`);
    if (ccList.length) headers.push(`Cc: ${ccList.join(',\r\n ')}`);
    if (bccList.length) headers.push(`Bcc: ${bccList.join(',\r\n ')}`);
    headers.push(
        `Date: ${new Date().toUTCString()}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        `Subject: ${subj ? encodeWords(subj) : ''}`
    );

    const message = `${headers.join('\r\n')}\r\n\r\n${wrap76(b64(html))}\r\n`;
    return Buffer.from(message, 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
