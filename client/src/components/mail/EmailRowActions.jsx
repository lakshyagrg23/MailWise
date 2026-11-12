import React from 'react';
import { Typography, Box, Tooltip, IconButton } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { AttachmentChip } from './emailRowStyles';

/** Right part of a list row: read toggle, AI summary trigger, attachment badge and date. */
const EmailRowActions = ({
  isSent, isUnread, showSummary, attachname, dateDisplay, fullTimestamp, onToggleRead, onToggleSummary,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5, minWidth: 200 }}>
    {/* Mark as read / unread (inbox rows only) */}
    {!isSent && (
      <Tooltip title={isUnread ? 'Mark as read' : 'Mark as unread'}>
        <IconButton
          size="small"
          onClick={onToggleRead}
          sx={{ color: '#94a3b8', '&:hover': { color: '#2563eb', backgroundColor: '#f1f5f9' } }}
        >
          {isUnread ? <MarkEmailReadOutlinedIcon sx={{ fontSize: 18 }} /> : <MarkEmailUnreadOutlinedIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Tooltip>
    )}

    {/* Quick AI Summary Button (sent mail has no stored row to cache a summary in) */}
    {!isSent && <Tooltip title={showSummary ? "Hide Summary" : "View AI Summary"}>
      <IconButton
        size="small"
        onClick={onToggleSummary}
        sx={{
          color: showSummary ? '#2563eb' : '#94a3b8',
          backgroundColor: showSummary ? '#eff6ff' : 'transparent',
          '&:hover': {
            color: '#2563eb',
            backgroundColor: '#f1f5f9'
          }
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>}

    {/* Attachment Badge */}
    {attachname && (
      <Tooltip title={`Attachment: ${attachname}`}>
        <AttachmentChip>
          <AttachFileIcon />
          <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {attachname}
          </Typography>
        </AttachmentChip>
      </Tooltip>
    )}

    {/* Timestamp */}
    <Tooltip title={fullTimestamp} placement="top">
      <Typography
        sx={{
          fontSize: '13px',
          fontWeight: 500,
          color: '#64748b',
          minWidth: 70,
          textAlign: 'right',
          userSelect: 'none',
          fontFamily: "'Inter', sans-serif"
        }}
      >
        {dateDisplay}
      </Typography>
    </Tooltip>
  </Box>
);

export default EmailRowActions;
