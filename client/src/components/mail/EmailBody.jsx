import React, { useEffect, useMemo, useState } from 'react';
import { styled } from '@mui/material';
import { motion } from 'framer-motion';
import { formatEmailBody } from '../utils/formatEmailBody';

const StyledBody = styled(motion.div)({
    fontSize: '14.5px',
    color: '#1e293b',
    lineHeight: '1.7',
    padding: '24px 28px',
    borderRadius: '12px',
    background: '#ffffff',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    border: '1px solid #e2e8f0',
    position: 'relative',

    '&[data-format="html"]': {
        whiteSpace: 'normal',
    },

    'h1, h2, h3, h4, h5, h6': {
        color: '#0f172a',
        marginTop: '1.2em',
        marginBottom: '0.6em',
        fontWeight: 600,
    },
    h1: { fontSize: '1.5em' },
    h2: { fontSize: '1.3em' },
    h3: { fontSize: '1.15em' },

    p: {
        margin: '0 0 1em 0',
    },

    ul: {
        paddingLeft: '1.5em',
        marginBottom: '1em',
    },
    ol: {
        paddingLeft: '1.5em',
        marginBottom: '1em',
    },
    'ul li, ol li': {
        marginBottom: '0.4em',
    },

    img: {
        maxWidth: '100%',
        borderRadius: '8px',
        margin: '1em 0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    },

    b: { fontWeight: 600 },
    strong: { fontWeight: 600 },
    i: { fontStyle: 'italic' },
    em: { fontStyle: 'italic' },
    
    a: {
        color: '#2563eb',
        fontWeight: 500,
        textDecoration: 'underline',
        '&:hover': {
            color: '#1d4ed8',
        },
    },

    code: {
        background: '#f1f5f9',
        color: '#334155',
        padding: '3px 6px',
        borderRadius: '4px',
        fontSize: '13px',
        fontFamily: 'monospace',
    },

    blockquote: {
        borderLeft: '3px solid #cbd5e1',
        background: '#f8fafc',
        padding: '10px 16px',
        fontStyle: 'italic',
        borderRadius: '4px',
        color: '#475569',
        margin: '1em 0',
    },
});

const TRUSTED_KEY = 'mailwise_trusted_image_senders';

const senderAddress = (sender) => {
    const m = /<([^>]+)>/.exec(sender || '');
    return (m ? m[1] : sender || '').trim().toLowerCase();
};

const readTrusted = () => {
    try {
        return JSON.parse(localStorage.getItem(TRUSTED_KEY)) || [];
    } catch {
        return [];
    }
};

const EmailBody = ({ email }) => {
    const address = senderAddress(email?.sender);
    const [trusted, setTrusted] = useState(readTrusted);
    const isTrusted = !!address && trusted.includes(address);
    const [allowImages, setAllowImages] = useState(isTrusted);

    // Trusted senders load automatically; everyone else is re-blocked per email
    useEffect(() => {
        setAllowImages(isTrusted);
    }, [email?.id, email?.body, isTrusted]);

    const trustSender = () => {
        const next = [...new Set([...trusted, address])];
        setTrusted(next);
        try {
            localStorage.setItem(TRUSTED_KEY, JSON.stringify(next));
        } catch {
            /* storage unavailable: trust applies for this session only */
        }
        setAllowImages(true);
    };

    const { html, isHtml, blockedImages } = useMemo(
        () => formatEmailBody(email?.body, { allowImages }),
        [email?.body, allowImages]
    );

    return (
        <>
            {blockedImages > 0 && !allowImages && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 14px',
                        marginBottom: '8px',
                        fontSize: '13px',
                        color: '#475569',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                    }}
                >
                    <span>Remote images blocked ({blockedImages})</span>
                    <button
                        type="button"
                        onClick={() => setAllowImages(true)}
                        style={{
                            border: 'none',
                            background: 'none',
                            color: '#2563eb',
                            fontWeight: 500,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                        }}
                    >
                        Load images
                    </button>
                    {address && (
                        <button
                            type="button"
                            onClick={trustSender}
                            style={{
                                border: 'none',
                                background: 'none',
                                color: '#2563eb',
                                fontWeight: 500,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: 0,
                            }}
                        >
                            Always load from {address}
                        </button>
                    )}
                </div>
            )}
            <StyledBody
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                data-format={isHtml ? 'html' : 'text'}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </>
    );
};

export default EmailBody;
