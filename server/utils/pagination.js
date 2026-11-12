// Opaque Gmail page token from ?pageToken=; ignore anything that isn't a plain token string
export const pageTokenFrom = (req) => {
    const t = req.query?.pageToken;
    return typeof t === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(t) ? t : undefined;
};
