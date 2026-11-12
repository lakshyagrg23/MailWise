import React, { useContext, useEffect, useRef, useState } from 'react';
import { sendEmail } from '../api/emails';
import { saveDraft as saveDraftApi, deleteDraft } from '../api/drafts';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Paper,
  Slide,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Minimize';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckIcon from '@mui/icons-material/Check';
import { emailContext } from '../App';
import Auto_email from './Auto_email';

const AUTOSAVE_DELAY_MS = 2500;
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const snapshot = (d = {}) =>
  JSON.stringify([d.to || '', d.cc || '', d.bcc || '', d.subject || '', d.body || '']);

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

const Compose = ({ openDialog, setOpenDialog }) => {
  const hook = useContext(emailContext);
  const data = hook.data || {};

  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const inflight = useRef(Promise.resolve());
  const lastSaved = useRef(snapshot());
  const draftIdRef = useRef(undefined);

  const hasContent = !!(data.to || data.cc || data.bcc || data.subject || data.body);
  const dirty = snapshot(data) !== lastSaved.current;

  // Keep the draft id ref aligned with state (set after loading or saving a draft)
  useEffect(() => {
    draftIdRef.current = data.draftId;
  }, [data.draftId]);

  // On open: treat the loaded content as already saved, and reveal Cc/Bcc if the draft has them
  useEffect(() => {
    if (!openDialog) return;
    lastSaved.current = snapshot(hook.data);
    setMinimized(false);
    setSaveState(hook.data?.draftId ? 'saved' : 'idle');
    setSaveError('');
    setSendError('');
    setShowCc(!!hook.data?.cc);
    setShowBcc(!!hook.data?.bcc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDialog]);

  const onValueChange = (e) => {
    hook.setData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Serialized so two overlapping saves can never create two drafts
  const saveDraft = () => {
    const run = async () => {
      const current = hook.data || {};
      const snap = snapshot(current);
      setSaveState('saving');
      setSaveError('');
      try {
        const { to, cc, bcc, subject, body } = current;
        const saved = await saveDraftApi(draftIdRef.current, { to, cc, bcc, subject, body });
        draftIdRef.current = saved.draftId;
        lastSaved.current = snap;
        hook.setData((prev) => ({ ...prev, draftId: saved.draftId }));
        hook.setDraftsVersion((v) => v + 1);
        setSaveState('saved');
        return true;
      } catch (err) {
        setSaveState('error');
        setSaveError(err.response?.data?.error || 'Could not save draft');
        return false;
      }
    };
    inflight.current = inflight.current.then(run, run);
    return inflight.current;
  };

  // Autosave shortly after the user stops typing
  useEffect(() => {
    if (!openDialog || !hasContent || !dirty || sending) return undefined;
    const t = setTimeout(saveDraft, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDialog, data.to, data.cc, data.bcc, data.subject, data.body, sending]);

  const reset = () => {
    setOpenDialog(false);
    setExpanded(false);
    setSaveState('idle');
    hook.setData({});
  };

  // Closing keeps unsaved text as a draft (like Gmail); stay open if that fails
  const closeCompose = async () => {
    if (hasContent && dirty && !(await saveDraft())) return;
    reset();
  };

  const discard = async () => {
    await inflight.current;
    if (draftIdRef.current) {
      try {
        await deleteDraft(draftIdRef.current);
        hook.setDraftsVersion((v) => v + 1);
      } catch (err) {
        console.error('Deleting draft error:', err);
      }
    }
    reset();
  };

  const sendMail = async () => {
    setSendError('');
    setSending(true);
    try {
      await inflight.current; // let any in-flight save finish so the draft id is final
      const { to, cc, bcc, subject, body } = hook.data;
      await sendEmail({ to, cc, bcc, subject, body, draftId: draftIdRef.current });
      hook.setmessageSent(true);
      hook.setDraftsVersion((v) => v + 1);
      reset();
    } catch (err) {
      setSendError(err.response?.data?.error || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const title = data.subject?.trim() || 'New Message';
  const canSend = !!data.to?.trim() && !sending;

  const statusText =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Draft saved'
        : saveState === 'error'
          ? saveError
          : '';

  const barIcon = { color: '#e2e8f0', '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)' } };

  return (
    <>
      <Slide direction="up" in={!!openDialog} mountOnEnter unmountOnExit>
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            // Centered via auto margins, not a transform: Slide owns `transform` on this element
            left: expanded ? 0 : 'auto',
            right: expanded ? 0 : { xs: 0, sm: 24 },
            mx: expanded ? 'auto' : 0,
            bottom: 0,
            width: expanded ? 'min(860px, 96vw)' : { xs: '100%', sm: 560 },
            height: minimized ? 'auto' : expanded ? '78vh' : { xs: '100%', sm: 560 },
            maxHeight: '100vh',
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: { xs: 0, sm: '14px 14px 0 0' },
            overflow: 'hidden',
            border: '1px solid #cbd5e1',
            borderBottom: 'none',
            boxShadow: '0 12px 40px rgba(15, 23, 42, 0.22)',
            backgroundColor: '#ffffff',
            fontFamily: FONT,
          }}
        >
          {/* Title bar */}
          <Box
            onClick={() => minimized && setMinimized(false)}
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
                <IconButton size="small" sx={barIcon} onClick={() => setMinimized((m) => !m)}>
                  <MinimizeIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={expanded ? 'Exit full view' : 'Full view'}>
                <IconButton
                  size="small"
                  sx={{ ...barIcon, display: { xs: 'none', sm: 'inline-flex' } }}
                  onClick={() => {
                    setExpanded((x) => !x);
                    setMinimized(false);
                  }}
                >
                  {expanded ? (
                    <CloseFullscreenIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <OpenInFullIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title="Save & close">
                <IconButton size="small" sx={barIcon} onClick={closeCompose}>
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {!minimized && (
            <>
              {/* Recipients + subject */}
              <Box sx={{ flexShrink: 0 }}>
                <FieldRow
                  label="To"
                  name="to"
                  value={data.to || ''}
                  onChange={onValueChange}
                  placeholder="Recipients"
                  autoFocus
                  right={
                    <Box sx={{ display: 'flex' }}>
                      {!showCc && <LinkButton onClick={() => setShowCc(true)}>Cc</LinkButton>}
                      {!showBcc && <LinkButton onClick={() => setShowBcc(true)}>Bcc</LinkButton>}
                    </Box>
                  }
                />
                {showCc && (
                  <FieldRow label="Cc" name="cc" value={data.cc || ''} onChange={onValueChange} />
                )}
                {showBcc && (
                  <FieldRow label="Bcc" name="bcc" value={data.bcc || ''} onChange={onValueChange} />
                )}
                <FieldRow
                  name="subject"
                  value={data.subject || ''}
                  onChange={onValueChange}
                  placeholder="Subject"
                />
              </Box>

              {/* Message body */}
              <Box
                component="textarea"
                name="body"
                value={data.body || ''}
                onChange={onValueChange}
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

              {sendError && (
                <Typography
                  sx={{ px: 2, py: 0.75, fontSize: 13, color: '#b91c1c', backgroundColor: '#fef2f2' }}
                >
                  {sendError}
                </Typography>
              )}

              {/* Action bar */}
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
                    onClick={sendMail}
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
                      onClick={() => hook.setOpenAi(true)}
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
                    {saveState === 'saved' && <CheckIcon sx={{ fontSize: 16, color: '#16a34a' }} />}
                  </Box>
                </Box>

                <Tooltip title={data.draftId ? 'Discard draft' : 'Discard'}>
                  <IconButton
                    size="small"
                    onClick={discard}
                    sx={{ color: '#94a3b8', '&:hover': { color: '#dc2626', backgroundColor: '#fef2f2' } }}
                  >
                    <DeleteOutlineOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </>
          )}
        </Paper>
      </Slide>

      {/* AI Draft Assistant modal */}
      <Dialog
        open={!!hook.openAi}
        onClose={() => hook.setOpenAi(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1,
            backgroundColor: '#ffffff',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            maxWidth: '600px',
            width: '95%',
          },
        }}
      >
        <DialogContent sx={{ p: 2 }}>
          <Auto_email />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Compose;
