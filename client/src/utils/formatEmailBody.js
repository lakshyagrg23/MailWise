import DOMPurify from 'dompurify';

const HTML_HINT = /<\s*\/?\s*(html|head|body|div|p|br|span|a|img|table|tbody|thead|tr|td|th|ul|ol|li|h[1-6]|b|i|u|strong|em|blockquote|pre|code|center|font|hr|svg|script|style|iframe|form|input|button|math|details|video|audio|link|meta|base|object|embed)\b[^>]*>/i;

const SAFE_LINK = /^(?:https?:|mailto:)/i;
const SAFE_DATA_IMAGE = /^data:image\/(?:png|gif|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i;
const REMOTE_IMAGE = /^(?:https?:)?\/\//i;

export const escapeHtml = (s) =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export const looksLikeHtml = (text) => HTML_HINT.test(text);

/**
 * Builds a formatter bound to a DOMPurify instance (injectable so it can be
 * tested under jsdom). Returns { html, isHtml, blockedImages }.
 */
export const createFormatter = (purify) => {
    const state = { allowImages: false, blocked: 0 };

    purify.addHook('afterSanitizeAttributes', (node) => {
        const tag = node.nodeName ? node.nodeName.toLowerCase() : '';

        if (tag === 'a') {
            const href = node.getAttribute('href');
            if (href !== null && !SAFE_LINK.test(href.trim())) {
                node.removeAttribute('href');
            }
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }

        if (tag === 'img') {
            const src = (node.getAttribute('src') || '').trim();
            const isData = SAFE_DATA_IMAGE.test(src);
            const isRemote = REMOTE_IMAGE.test(src);
            if (isData) return;
            if (isRemote && state.allowImages) {
                node.setAttribute('referrerpolicy', 'no-referrer');
                return;
            }
            if (isRemote) state.blocked += 1;
            node.remove();
        }
    });

    const config = {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed', 'script', 'link', 'meta', 'base', 'video', 'audio', 'source', 'svg', 'math', 'input', 'button', 'textarea', 'select'],
        FORBID_ATTR: ['style', 'srcset', 'background', 'poster', 'action', 'formaction', 'onerror', 'onload', 'onclick', 'onmouseover'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|data:image\/(?:png|gif|jpe?g|webp);base64,)/i,
        ALLOW_DATA_ATTR: false,
    };

    const sanitize = (html) => purify.sanitize(html, config);

    return (text, { allowImages = false } = {}) => {
        if (!text) return { html: 'No message content available.', isHtml: false, blockedImages: 0 };
        state.allowImages = allowImages;
        state.blocked = 0;

        const isHtml = looksLikeHtml(text);
        let input;
        if (isHtml) {
            input = text;
        } else {
            input = escapeHtml(text)
                .replace(/https?:\/\/(?:(?!&(?:quot|lt|gt|#39);)[^\s<])+/g, (url) => {
                    // text is already escaped; the pattern stops at escaped quote/angle entities
                    return `<a href="${url}">${url}</a>`;
                })
                .replace(/\r?\n/g, '<br />');
        }
        const html = sanitize(input);
        return { html, isHtml, blockedImages: state.blocked };
    };
};

let defaultFormatter;
export const formatEmailBody = (text, opts) => {
    if (!defaultFormatter) defaultFormatter = createFormatter(DOMPurify);
    return defaultFormatter(text, opts);
};
