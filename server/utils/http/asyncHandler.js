/**
 * Express 4 does not catch rejected promises from async handlers.
 * Wrap every async handler so errors reach the central error middleware.
 */
export const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
