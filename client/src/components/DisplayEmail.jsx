import React, { useState } from 'react';
import { Typography, Box, styled, Tooltip, Avatar, IconButton } from "@mui/material";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';
import { routes } from '../routes/route';
import { getRandomColor } from '../content/getColor';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import http from '../api/http';


const EmailRow = styled(Box)`
  position: relative;
  padding: 12px 20px;
  background: #ffffff;
  display: flex;
  align-items: center;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s ease-in-out;

  &:hover {
    background: #f8fafc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
`;

const CategoryPill = styled(Box)`
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 9999px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  white-space: nowrap;
  user-select: none;
  background-color: ${(props) => `${props.color}15`};
  color: ${(props) => props.color};
  border: 1px solid ${(props) => `${props.color}30`};
`;

const AttachmentChip = styled(Box)`
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: #f1f5f9;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  color: #475569;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid #e2e8f0;

  & > svg {
    font-size: 14px;
    color: #64748b;
  }
`;

const SummaryDrawer = styled(motion.div)`
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px 20px;
  margin: 8px 20px 14px 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  font-family: 'Inter', sans-serif;
  color: #1e293b;
  font-size: 13.5px;
  line-height: 1.6;
`;

const formatEmailDate = (dateValue) => {
  if (!dateValue) return '';
  const d = dayjs(dateValue);
  if (!d.isValid()) return '';

  const now = dayjs();
  if (d.isSame(now, 'day')) {
    return d.format('h:mm A');
  }
  if (d.isSame(now, 'year')) {
    return d.format('MMM D');
  }
  return d.format('MM/DD/YYYY');
};

const formatFullTimestamp = (dateValue) => {
  if (!dateValue) return '';
  const d = dayjs(dateValue);
  return d.isValid() ? d.format('dddd, MMMM D, YYYY [at] h:mm A') : '';
};

const DisplayEmail = ({ email }) => {
  const navigate = useNavigate();
  const [showSummary, setShowSummary] = useState(false);
  const initialAiSummary = (email.emailsummary && (email.emailsummary.includes('•') || email.emailsummary.includes('Action Item:'))) 
    ? email.emailsummary 
    : '';
  const [summaryText, setSummaryText] = useState(initialAiSummary);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const senderName = email.sender?.includes('<')
    ? email.sender.split('<')[0].replace(/['"]/g, '').trim()
    : email.sender || 'Unknown';

  const categoryColor = getRandomColor(email.category || 'Miscellaneous');
  const dateDisplay = formatEmailDate(email.received_date);
  const fullTimestamp = formatFullTimestamp(email.received_date);

  const handleFetchSummary = async (e) => {
    e.stopPropagation();
    if (showSummary) {
      setShowSummary(false);
      return;
    }

    setShowSummary(true);

    // If summary is already a structured rich summary, don't re-fetch
    if (summaryText && (summaryText.includes('•') || summaryText.includes('Action Item:'))) {
      return;
    }

    setLoadingSummary(true);
    try {
      const response = await http.get(`/email/summarize/${email.email_id}`);

      if (response.data?.summary) {
        setSummaryText(response.data.summary);
      }
    } catch (err) {
      console.error('Failed to load on-demand summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <Box sx={{ borderBottom: '1px solid #f1f5f9' }}>
      <EmailRow
        onClick={() => {
          navigate(routes.view.path, { state: { email } });
        }}
        role="button"
        tabIndex={0}
      >
        {/* Left: Avatar & Sender Name */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: 220, minWidth: 200, overflow: 'hidden' }}>
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
            {senderName[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Tooltip title={senderName} placement="top">
            <Typography
              sx={{
                fontWeight: 600,
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

        {/* Middle: Category Pill & Subject Preview */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, px: 2 }}>
          <CategoryPill color={categoryColor}>
            {email.category || 'Miscellaneous'}
          </CategoryPill>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, overflow: 'hidden' }}>
            <Typography
              component="span"
              sx={{
                fontWeight: 600,
                fontSize: '14px',
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: "'Inter', sans-serif"
              }}
            >
              {email.subject || '(No Subject)'}
            </Typography>

            <Typography
              component="span"
              sx={{
                fontSize: '13.5px',
                color: '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: "'Inter', sans-serif"
              }}
            >
              — {email.emailsummary ? email.emailsummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) : ''}
            </Typography>
          </Box>
        </Box>

        {/* Right: Summary Trigger, Attachment & Date */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5, minWidth: 200 }}>
          {/* Quick AI Summary Button */}
          <Tooltip title={showSummary ? "Hide Summary" : "View AI Summary"}>
            <IconButton
              size="small"
              onClick={handleFetchSummary}
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
          </Tooltip>

          {/* Attachment Badge */}
          {email.attachname && (
            <Tooltip title={`Attachment: ${email.attachname}`}>
              <AttachmentChip>
                <AttachFileIcon />
                <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email.attachname}
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
      </EmailRow>

      {/* Expandable Structured Summary Card */}
      <AnimatePresence>
        {showSummary && (
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
              <IconButton size="small" onClick={() => setShowSummary(false)} sx={{ color: '#94a3b8' }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>

            {loadingSummary ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                <CircularProgress size={16} sx={{ color: '#2563eb' }} />
                <Typography sx={{ fontSize: '13px', color: '#64748b' }}>Generating executive summary...</Typography>
              </Box>
            ) : (
              <Typography sx={{ fontSize: '13.5px', color: '#334155', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {summaryText || 'No summary available for this email.'}
              </Typography>
            )}
          </SummaryDrawer>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default DisplayEmail;
