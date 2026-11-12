import { useState, useContext } from 'react';
import { emailContext } from '../../context/emailContext';
import { updateEmail, summarizeEmail } from '../../api/emails';
import { getDraft } from '../../api/drafts';
import { isAiSummary } from '../../utils/summary';

/**
 * Behaviour of one list row: optimistic read/starred toggles, opening a draft in the compose
 * window, and the inline AI summary drawer.
 */
export const useEmailRow = (email) => {
  const hook = useContext(emailContext);

  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState(isAiSummary(email.emailsummary) ? email.emailsummary : '');
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Only inbox rows carry is_read; sent/draft rows never look unread
  const isUnread = email.is_read === false;
  const isStarred = !!email.is_starred;

  // Optimistic flag update (read / starred), persisted in the background; reverts on failure
  const patchEmail = (patch) =>
    hook.setEmails((prev) =>
      prev.map((e) => (e.email_id === email.email_id ? { ...e, ...patch } : e))
    );

  const setFlag = (patch, revert) => {
    patchEmail(patch);
    updateEmail(email.email_id, patch).catch((err) => {
      console.error('Failed to persist email state:', err);
      patchEmail(revert);
    });
  };

  // Opening an email marks it read
  const markAsRead = () => {
    if (!isUnread) return;
    setFlag({ is_read: true }, { is_read: false });
  };

  const toggleRead = (e) => {
    e.stopPropagation();
    const read = isUnread; // unread -> read, read -> unread
    setFlag({ is_read: read }, { is_read: !read });
  };

  const toggleStar = (e) => {
    e.stopPropagation();
    setFlag({ is_starred: !isStarred }, { is_starred: isStarred });
  };

  const openDraft = async () => {
    try {
      const data = await getDraft(email.draft_id);
      hook.setData(data);
      hook.setComposeOpen(true);
    } catch (err) {
      console.error('Failed to open draft:', err);
    }
  };

  const toggleSummary = async (e) => {
    e.stopPropagation();
    if (showSummary) {
      setShowSummary(false);
      return;
    }

    setShowSummary(true);

    // If summary is already a structured rich summary, don't re-fetch
    if (isAiSummary(summaryText)) {
      return;
    }

    setLoadingSummary(true);
    try {
      const result = await summarizeEmail(email.email_id);

      if (result?.summary) {
        setSummaryText(result.summary);
      }
    } catch (err) {
      console.error('Failed to load on-demand summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  return {
    isUnread,
    isStarred,
    markAsRead,
    toggleRead,
    toggleStar,
    openDraft,
    summary: {
      show: showSummary,
      text: summaryText,
      loading: loadingSummary,
      toggle: toggleSummary,
      hide: () => setShowSummary(false),
    },
  };
};
