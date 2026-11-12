import { useContext, useEffect, useRef, useState } from 'react';
import { sendEmail } from '../../api/emails';
import { saveDraft as saveDraftApi, deleteDraft } from '../../api/drafts';
import { emailContext } from '../../context/emailContext';

const AUTOSAVE_DELAY_MS = 2500;

const snapshot = (d = {}) =>
  JSON.stringify([d.to || '', d.cc || '', d.bcc || '', d.subject || '', d.body || '']);

/**
 * State and behaviour of the compose window: the message fields live in context (`hook.data`) so a
 * draft row or the AI assistant can fill them; this hook adds window state, serialized draft
 * autosave, close/discard and send.
 */
export const useCompose = ({ openDialog, setOpenDialog }) => {
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

  const statusText =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Draft saved'
        : saveState === 'error'
          ? saveError
          : '';

  return {
    data,
    minimized, setMinimized,
    expanded, setExpanded,
    showCc, setShowCc,
    showBcc, setShowBcc,
    saveState,
    statusText,
    sending,
    sendError,
    canSend: !!data.to?.trim() && !sending,
    title: data.subject?.trim() || 'New Message',
    onValueChange,
    closeCompose,
    discard,
    sendMail,
  };
};
