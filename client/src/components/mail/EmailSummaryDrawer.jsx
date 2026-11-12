import React from 'react';
import { Typography, Box, IconButton } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { AnimatePresence } from 'framer-motion';
import { SummaryDrawer } from './emailRowStyles';

/** Expandable structured AI summary card shown under a list row. */
const EmailSummaryDrawer = ({ show, loading, text, onClose }) => (
  <AnimatePresence>
    {show && (
      <SummaryDrawer
        initial={{ opacity: 0, height: 0, marginTop: 0 }}
        animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
        exit={{ opacity: 0, height: 0, marginTop: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ fontSize: 16, color: '#2563eb' }} />
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              AI Summary
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ color: '#94a3b8' }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
            <CircularProgress size={16} sx={{ color: '#2563eb' }} />
            <Typography sx={{ fontSize: '13px', color: '#64748b' }}>Generating executive summary...</Typography>
          </Box>
        ) : (
          <Typography sx={{ fontSize: '13.5px', color: '#334155', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            {text || 'No summary available for this email.'}
          </Typography>
        )}
      </SummaryDrawer>
    )}
  </AnimatePresence>
);

export default EmailSummaryDrawer;
