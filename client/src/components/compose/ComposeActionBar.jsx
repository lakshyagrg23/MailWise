import React from 'react';
import { Box, Button, CircularProgress, IconButton, Tooltip } from '@mui/material';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckIcon from '@mui/icons-material/Check';

/** Bottom bar of the compose window: Send, AI Assist, saved tick (mobile) and Discard. */
const ComposeActionBar = ({ sending, canSend, saved, hasDraft, onSend, onAiAssist, onDiscard }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: 2,
      py: 1.25,
      flexShrink: 0,
      borderTop: '1px solid #eef2f6',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Button
        variant="contained"
        onClick={onSend}
        disabled={!canSend}
        disableElevation
        endIcon={
          sending ? (
            <CircularProgress size={14} sx={{ color: 'inherit' }} />
          ) : (
            <SendIcon sx={{ fontSize: 16 }} />
          )
        }
        sx={{
          backgroundColor: '#2563eb',
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: '999px',
          px: 2.75,
          '&:hover': { backgroundColor: '#1d4ed8' },
        }}
      >
        {sending ? 'Sending' : 'Send'}
      </Button>

      <Tooltip title="Draft with AI">
        <Button
          onClick={onAiAssist}
          startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            color: '#2563eb',
            borderRadius: '999px',
            '&:hover': { backgroundColor: '#eff6ff' },
          }}
        >
          AI Assist
        </Button>
      </Tooltip>

      <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center' }}>
        {saved && <CheckIcon sx={{ fontSize: 16, color: '#16a34a' }} />}
      </Box>
    </Box>

    <Tooltip title={hasDraft ? 'Discard draft' : 'Discard'}>
      <IconButton
        size="small"
        onClick={onDiscard}
        sx={{ color: '#94a3b8', '&:hover': { color: '#dc2626', backgroundColor: '#fef2f2' } }}
      >
        <DeleteOutlineOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  </Box>
);

export default ComposeActionBar;
