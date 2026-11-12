import { badRequest } from './httpErrors.js';

/** Gmail message ids are short alphanumeric strings; demo ids use the same alphabet. */
export const EMAIL_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
/** Gmail MIME part ids: dot-separated indexes such as "1" or "0.2.1" */
export const PART_ID_RE = /^\d{1,4}(\.\d{1,4}){0,9}$/;
/** Gmail draft ids */
export const DRAFT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** router.param handler that rejects malformed path params before any controller runs. */
export const validateParam = (re, message) => (req, res, next, value) =>
    re.test(value) ? next() : next(badRequest(message));

/** Positive-integer path param (database ids). */
export const validateIntParam = (message) => (req, res, next, value) =>
    /^[1-9]\d{0,9}$/.test(value) ? next() : next(badRequest(message));
