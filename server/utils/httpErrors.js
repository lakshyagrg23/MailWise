/** Error carrying an HTTP status; the central error middleware turns it into a JSON response. */
export class HttpError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.expose = true;
    }
}

export const badRequest = (msg, code) => new HttpError(400, msg, code);
export const notFound = (msg = 'Not found', code) => new HttpError(404, msg, code);
export const conflict = (msg, code) => new HttpError(409, msg, code);

/** Maps any thrown value to { status, body }. Unknown errors never leak their message. */
export const toErrorResponse = (err) => {
    if (err instanceof HttpError) {
        return { status: err.status, body: { error: err.message, ...(err.code ? { code: err.code } : {}) } };
    }
    // Gmail rejected the call for a missing OAuth scope: the user must sign in again
    if (err?.code === 403 && (/insufficient/i.test(err?.message || '') ||
        err?.errors?.some?.((e) => e?.reason === 'insufficientPermissions'))) {
        return {
            status: 403,
            body: { error: 'Extra Gmail permission is required. Please sign out and sign in again.', code: 'reauth_required' }
        };
    }
    // Prisma: unique constraint / record not found
    if (err?.code === 'P2002') return { status: 409, body: { error: 'Already exists' } };
    if (err?.code === 'P2025') return { status: 404, body: { error: 'Not found' } };
    // body-parser errors (malformed JSON, payload too large)
    if (err?.type === 'entity.parse.failed') return { status: 400, body: { error: 'Invalid JSON body' } };
    if (err?.type === 'entity.too.large') return { status: 413, body: { error: 'Payload too large' } };
    return { status: 500, body: { error: 'Internal Server Error' } };
};
