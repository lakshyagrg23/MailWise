import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Refresh } from '../Refresh';

const NoMails = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
        textAlign: 'center',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Icon Circle */}
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: '#eff6ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
          border: '1px solid #dbeafe'
        }}
      >
        <MailOutlineIcon sx={{ fontSize: 26, color: '#2563eb' }} />
      </Box>

      {/* Heading */}
      <Typography
        sx={{
          fontSize: '16px',
          fontWeight: 700,
          color: '#0f172a',
          mb: 0.5
        }}
      >
        No emails found
      </Typography>

      {/* Description */}
      <Typography
        sx={{
          fontSize: '13.5px',
          color: '#64748b',
          maxWidth: '380px',
          lineHeight: 1.5,
          mb: 2.5
        }}
      >
        There are no messages in this category right now. Select another tab or refresh to check for new emails.
      </Typography>

      {/* Refresh Trigger */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
        onClick={Refresh}
        sx={{
          borderColor: '#cbd5e1',
          color: '#334155',
          borderRadius: 2,
          px: 2,
          py: 0.7,
          fontSize: '13px',
          fontWeight: 600,
          textTransform: 'none',
          '&:hover': {
            borderColor: '#2563eb',
            backgroundColor: '#f8fafc',
            color: '#2563eb'
          }
        }}
      >
        Refresh Inbox
      </Button>
    </Box>
  );
};

export default NoMails;
