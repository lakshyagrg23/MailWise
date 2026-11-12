import React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Minimize';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import { FONT } from './constants';

const barIcon = { color: '#e2e8f0', '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)' } };

/** Dark header of the compose window: subject, save status, minimize / full view / save & close. */
const ComposeTitleBar = ({
  title, statusText, saveState, minimized, expanded,
  onBarClick, onToggleMinimize, onToggleExpand, onClose,
}) => (
  <Box
    onClick={onBarClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      pl: 2,
      pr: 0.75,
      height: 44,
      flexShrink: 0,
      backgroundColor: '#1e293b',
      cursor: minimized ? 'pointer' : 'default',
    }}
  >
    <Typography
      noWrap
      sx={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', fontFamily: FONT }}
    >
      {title}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
      {statusText && !minimized && (
        <Typography
          sx={{
            fontSize: 12,
            mr: 1,
            color: saveState === 'error' ? '#fca5a5' : '#94a3b8',
            display: { xs: 'none', sm: 'block' },
          }}
          noWrap
        >
          {statusText}
        </Typography>
      )}
      <Tooltip title={minimized ? 'Restore' : 'Minimize'}>
        <IconButton size="small" sx={barIcon} onClick={onToggleMinimize}>
          <MinimizeIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={expanded ? 'Exit full view' : 'Full view'}>
        <IconButton
          size="small"
          sx={{ ...barIcon, display: { xs: 'none', sm: 'inline-flex' } }}
          onClick={onToggleExpand}
        >
          {expanded ? (
            <CloseFullscreenIcon sx={{ fontSize: 16 }} />
          ) : (
            <OpenInFullIcon sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Tooltip>
      <Tooltip title="Save & close">
        <IconButton size="small" sx={barIcon} onClick={onClose}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  </Box>
);

export default ComposeTitleBar;
