import dayjs from 'dayjs';

export const formatEmailDate = (dateValue) => {
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

export const formatFullTimestamp = (dateValue) => {
  if (!dateValue) return '';
  const d = dayjs(dateValue);
  return d.isValid() ? d.format('dddd, MMMM D, YYYY [at] h:mm A') : '';
};

/**
 * Who a list row is about. For sent/draft mail `sender` holds the recipient(s), so the first one's
 * name is shown with a "To:" / "Draft:" prefix.
 */
export const getParty = (email) => {
  const isDraft = !!email.is_draft;
  const isSent = !!email.is_sent || isDraft;
  const firstParty = (isSent ? (email.sender || '').split(',')[0] : email.sender) || '';
  const partyName = firstParty.includes('<')
    ? firstParty.split('<')[0].replace(/['"]/g, '').trim() || firstParty.replace(/[<>]/g, '').trim()
    : firstParty || 'Unknown';
  const senderName = isDraft ? `Draft: ${partyName}` : isSent ? `To: ${partyName}` : partyName;
  return { isDraft, isSent, partyName, senderName };
};
