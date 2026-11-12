/** Largest attachment the download endpoint will serve (Gmail's own message limit is ~25 MB). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const isAttachmentPart = (part) =>
    Boolean(part.filename) && Boolean(part.body?.attachmentId || part.body?.data);

/**
 * Walks the whole MIME tree (attachments can sit inside nested multipart/* parts) and returns
 * metadata only. `partId` is Gmail's stable position of the part within the message; unlike
 * `attachmentId` it does not change between fetches, so it is what the API exposes.
 */
export const collectAttachments = (payload) => {
    const found = [];
    const walk = (part) => {
        if (!part) return;
        if (isAttachmentPart(part)) {
            found.push({
                partId: part.partId,
                filename: part.filename,
                mimeType: part.mimeType || 'application/octet-stream',
                size: part.body.size ?? 0,
            });
        }
        (part.parts || []).forEach(walk);
    };
    walk(payload);
    return found.filter((a) => a.partId !== undefined && a.partId !== '');
};

/** Finds the attachment part with the given partId, or null. */
export const findAttachmentPart = (payload, partId) => {
    let match = null;
    const walk = (part) => {
        if (!part || match) return;
        if (part.partId === partId && isAttachmentPart(part)) {
            match = part;
            return;
        }
        (part.parts || []).forEach(walk);
    };
    walk(payload);
    return match;
};

const MIME_RE = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/;

/** Content-Type from sender-controlled data: anything malformed becomes octet-stream. */
export const safeContentType = (mimeType) =>
    typeof mimeType === 'string' && MIME_RE.test(mimeType) ? mimeType : 'application/octet-stream';

/**
 * Content-Disposition that always forces a download (never inline, so an HTML/SVG attachment
 * cannot render on the API origin) with a header-injection-safe filename (RFC 6266 / 5987).
 */
export const attachmentDisposition = (filename) => {
    const name = String(filename || 'attachment').replace(/[\r\n"\\/]/g, '_').slice(0, 200) || 'attachment';
    const ascii = name.replace(/[^\x20-\x7e]/g, '_');
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};
