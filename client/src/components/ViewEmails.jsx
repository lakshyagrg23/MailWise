import React, { useContext, useEffect, useState } from 'react';
import http from '../api/http';
import {
  Box,
  Typography,
  IconButton,
  Divider,
  Paper,
  Avatar,
  Tooltip,
  CircularProgress,
  Button
} from '@mui/material';
import { useOutletContext, useLocation, useNavigate } from "react-router-dom";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DownloadIcon from '@mui/icons-material/Download';
import Emailbody from './Emailbody';
import { emailContext } from "../App";
import { getRandomColor } from '../content/getColor';
import dayjs from 'dayjs';

const ViewEmails = () => {
  const { setEmails } = useContext(emailContext);
  const { state } = useLocation();
  const { email: initialEmail } = state || {};
  const { openDrawer } = useOutletContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState(initialEmail);
  const [emailBody, setEmailBody] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Summary State (only initialize if real AI summary exists)
  const initialAiSummary = (email?.emailsummary && (email.emailsummary.includes('•') || email.emailsummary.includes('Action Item:'))) 
    ? email.emailsummary 
    : '';
  const [summary, setSummary] = useState(initialAiSummary);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    if (email?.email_id && !emailBody) {
      const fetchEmailData = async () => {
        setLoading(true);
        try {
          const response = await http.get(`/fetch-email/${email.email_id}`);
          if (response.data?.email) {
            setEmailBody(response.data.email.body);
            setAttachments(response.data.email.attachments || []);
          }
        } catch (error) {
          console.error("Error fetching email:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchEmailData();
    } else {
      setLoading(false);
    }
  }, [email, emailBody]);

  const handleGenerateSummary = async () => {
    if (!email?.email_id) return;
    setLoadingSummary(true);
    try {
      const res = await http.get(`/email/summarize/${email.email_id}`);
      if (res.data?.summary) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Failed to generate AI summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const deleteEmail = () => {
    if (!email?.email_id && !email?._id) return;
    setEmails(prev => prev.filter(e => (e.email_id || e._id) !== (email.email_id || email._id)));
    navigate(-1);
  };

  if (!email) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">No email selected.</Typography>
        <Button sx={{ mt: 2 }} onClick={() => navigate(-1)} startIcon={<ArrowBackIcon />}>
          Back to Inbox
        </Button>
      </Box>
    );
  }

  const senderRaw = email.sender || 'Unknown Sender';
  const senderName = senderRaw.includes('<') ? senderRaw.split('<')[0].replace(/['"]/g, '').trim() : senderRaw;
  const senderEmail = senderRaw.includes('<') ? senderRaw.split('<')[1]?.replace('>', '') : '';
  const categoryColor = getRandomColor(email.category || 'Miscellaneous');

  const formattedDate = email.received_date
    ? dayjs(email.received_date).format('dddd, MMMM D, YYYY [at] h:mm A')
    : 'Unknown Date';

  const isRichSummary = summary && (summary.includes('•') || summary.includes('Action Item:'));

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "1100px",
        mx: "auto",
        p: { xs: 2, sm: 3 },
        pb: 8,
        boxSizing: "border-box"
      }}
    >
      <Paper
        elevation={0}
        sx={{
          backgroundColor: "#ffffff",
          borderRadius: 3,
          border: "1px solid #e2e8f0",
          p: { xs: 2.5, md: 3.5 },
          maxWidth: '1000px',
          mx: 'auto'
        }}
      >
        {/* Top Action Toolbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 2, borderBottom: '1px solid #f1f5f9' }}>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ color: '#475569', fontWeight: 600, textTransform: 'none', '&:hover': { backgroundColor: '#f1f5f9' } }}
          >
            Back
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Delete Email">
              <IconButton onClick={deleteEmail} size="small" sx={{ color: '#64748b', '&:hover': { color: '#dc2626' } }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Email Header */}
        <Box sx={{ py: 3 }}>
          {/* Subject & Category */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '22px', lineHeight: 1.3 }}>
              {email.subject || '(No Subject)'}
            </Typography>

            <Box
              sx={{
                fontSize: '11px',
                fontWeight: 700,
                px: 1.5,
                py: 0.5,
                borderRadius: '9999px',
                backgroundColor: `${categoryColor}15`,
                color: categoryColor,
                border: `1px solid ${categoryColor}30`,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                whiteSpace: 'nowrap'
              }}
            >
              {email.category || 'Miscellaneous'}
            </Box>
          </Box>

          {/* Sender & Date Bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  fontSize: 15,
                  fontWeight: 600,
                  bgcolor: getRandomColor(senderName),
                  color: '#ffffff'
                }}
              >
                {senderName[0]?.toUpperCase() || 'U'}
              </Avatar>

              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>
                  {senderName}
                </Typography>
                {senderEmail && (
                  <Typography sx={{ fontSize: '12.5px', color: '#64748b' }}>
                    {senderEmail}
                  </Typography>
                )}
              </Box>
            </Box>

            <Typography sx={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              {formattedDate}
            </Typography>
          </Box>
        </Box>

        {/* AI Executive Summary Box */}
        <Box
          sx={{
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 2.5,
            p: 2.5,
            mb: 3
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeIcon sx={{ fontSize: 18, color: '#2563eb' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                AI Executive Summary
              </Typography>
            </Box>

            {!summary && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleGenerateSummary}
                disabled={loadingSummary}
                startIcon={loadingSummary ? <CircularProgress size={12} sx={{ color: '#2563eb' }} /> : <AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                sx={{
                  fontSize: '12px',
                  textTransform: 'none',
                  borderColor: '#2563eb',
                  color: '#2563eb',
                  fontWeight: 600,
                  borderRadius: 1.5,
                  '&:hover': { backgroundColor: '#eff6ff', borderColor: '#1d4ed8' }
                }}
              >
                {loadingSummary ? 'Summarizing...' : 'Generate Summary'}
              </Button>
            )}
          </Box>

          {loadingSummary ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
              <CircularProgress size={16} sx={{ color: '#2563eb' }} />
              <Typography sx={{ fontSize: '13px', color: '#64748b' }}>Generating executive summary with Gemini...</Typography>
            </Box>
          ) : summary ? (
            <Typography sx={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {summary}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: '13px', color: '#94a3b8' }}>
              Click "Generate Summary" above to create an instant AI summary for this email.
            </Typography>
          )}
        </Box>

        {/* Email Content Body */}
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
            <CircularProgress size={24} sx={{ color: '#2563eb' }} />
            <Typography sx={{ fontSize: '14px', color: '#64748b' }}>Loading email content...</Typography>
          </Box>
        ) : (
          <Emailbody email={{ ...email, body: emailBody }} />
        )}

        {/* Attachments Section */}
        {attachments && attachments.length > 0 && (
          <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid #f1f5f9' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <AttachFileIcon sx={{ fontSize: 18, color: '#475569' }} />
              <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                Attachments ({attachments.length})
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {attachments.map((att, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    '&:hover': { backgroundColor: '#f8fafc' }
                  }}
                >
                  <AttachFileIcon sx={{ fontSize: 18, color: '#2563eb' }} />
                  <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#334155', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.filename || `attachment-${idx + 1}`}
                  </Typography>
                  {att.data && (
                    <IconButton
                      size="small"
                      component="a"
                      href={`data:${att.mimeType || 'application/octet-stream'};base64,${att.data}`}
                      download={att.filename || 'attachment'}
                      sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ViewEmails;