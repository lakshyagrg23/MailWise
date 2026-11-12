import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { FONT } from './constants';

// Borderless row used for To / Cc / Bcc / Subject, separated by hairlines (Gmail/Outlook style)
const FieldRow = ({ label, name, value, onChange, placeholder, right, autoFocus }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 2,
      minHeight: 40,
      borderBottom: '1px solid #eef2f6',
    }}
  >
    {label && (
      <Typography sx={{ fontSize: 13.5, color: '#64748b', width: 34, flexShrink: 0 }}>
        {label}
      </Typography>
    )}
    <input
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="off"
      spellCheck={name === 'subject'}
      style={{
        flex: 1,
        minWidth: 0,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontSize: name === 'subject' ? 15 : 14,
        fontWeight: name === 'subject' ? 500 : 400,
        color: '#0f172a',
        fontFamily: FONT,
        padding: '8px 0',
      }}
    />
    {right}
  </Box>
);

const LinkButton = ({ children, onClick }) => (
  <Button
    size="small"
    onClick={onClick}
    sx={{
      minWidth: 0,
      px: 0.75,
      py: 0,
      fontSize: 12.5,
      fontWeight: 600,
      textTransform: 'none',
      color: '#64748b',
      '&:hover': { color: '#2563eb', backgroundColor: 'transparent' },
    }}
  >
    {children}
  </Button>
);

/** Recipients, subject and message body. Values come from `data`; edits go through `onChange`. */
const ComposeFields = ({ data, showCc, showBcc, onShowCc, onShowBcc, onChange }) => (
  <>
    {/* Recipients + subject */}
    <Box sx={{ flexShrink: 0 }}>
      <FieldRow
        label="To"
        name="to"
        value={data.to || ''}
        onChange={onChange}
        placeholder="Recipients"
        autoFocus
        right={
          <Box sx={{ display: 'flex' }}>
            {!showCc && <LinkButton onClick={onShowCc}>Cc</LinkButton>}
            {!showBcc && <LinkButton onClick={onShowBcc}>Bcc</LinkButton>}
          </Box>
        }
      />
      {showCc && (
        <FieldRow label="Cc" name="cc" value={data.cc || ''} onChange={onChange} />
      )}
      {showBcc && (
        <FieldRow label="Bcc" name="bcc" value={data.bcc || ''} onChange={onChange} />
      )}
      <FieldRow
        name="subject"
        value={data.subject || ''}
        onChange={onChange}
        placeholder="Subject"
      />
    </Box>

    {/* Message body */}
    <Box
      component="textarea"
      name="body"
      value={data.body || ''}
      onChange={onChange}
      placeholder="Write your message…"
      sx={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        boxSizing: 'border-box',
        resize: 'none',
        border: 'none',
        outline: 'none',
        px: 2,
        py: 1.5,
        fontSize: 14.5,
        lineHeight: 1.65,
        color: '#1e293b',
        fontFamily: FONT,
        backgroundColor: '#ffffff',
      }}
    />
  </>
);

export default ComposeFields;
