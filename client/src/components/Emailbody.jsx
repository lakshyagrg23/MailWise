import React from 'react';
import { Box, styled } from '@mui/material';

// Styled component for email body
const StyledBody = styled(Box)({
    fontSize: '15px',
    color: '#333',
    lineHeight: '1.6',
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
    whiteSpace: 'pre-wrap', // Preserves new lines and spacing
    wordBreak: 'break-word', // Prevents long words from overflowing
});

// Function to convert plain text URLs into clickable links
const formatEmailBody = (text) => {
    if (!text) return "No content available";

    return text.replace(/(https?:\/\/[^\s]+)/g, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
};

const EmailBody = ({ email }) => {
    return (
        <StyledBody dangerouslySetInnerHTML={{ __html: formatEmailBody(email?.body) }} />
    );
};

export default EmailBody;
