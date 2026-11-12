import React from 'react';
import { Typography, Box, Tooltip, Avatar, IconButton } from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import { getRandomColor } from '../../utils/getColor';

/** Left part of a list row: star (inbox rows only), avatar and sender / recipient name. */
const EmailRowSender = ({ isSent, isStarred, isUnread, senderName, avatarLetter, onToggleStar }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 250, minWidth: 230, overflow: 'hidden' }}>
    {!isSent && (
      <Tooltip title={isStarred ? 'Unstar' : 'Star'}>
        <IconButton
          size="small"
          onClick={onToggleStar}
          sx={{ p: 0.5, color: isStarred ? '#f59e0b' : '#cbd5e1', '&:hover': { color: '#f59e0b' } }}
        >
          {isStarred ? <StarRoundedIcon sx={{ fontSize: 20 }} /> : <StarBorderRoundedIcon sx={{ fontSize: 20 }} />}
        </IconButton>
      </Tooltip>
    )}
    <Avatar
      sx={{
        width: 32,
        height: 32,
        fontSize: 13,
        fontWeight: 600,
        bgcolor: getRandomColor(senderName),
        color: '#ffffff',
        userSelect: 'none',
      }}
    >
      {avatarLetter}
    </Avatar>
    <Tooltip title={senderName} placement="top">
      <Typography
        sx={{
          fontWeight: isUnread ? 700 : 500,
          fontSize: '14px',
          color: '#1e293b',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: "'Inter', sans-serif"
        }}
      >
        {senderName}
      </Typography>
    </Tooltip>
  </Box>
);

export default EmailRowSender;
