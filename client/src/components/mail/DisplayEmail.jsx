import React from 'react';
import { Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { routes } from '../../routes/route';
import { getRandomColor } from '../../utils/getColor';
import { EmailRow, CategoryPill } from './emailRowStyles';
import { formatEmailDate, formatFullTimestamp, getParty } from './emailDisplay';
import { useEmailRow } from './useEmailRow';
import EmailRowSender from './EmailRowSender';
import EmailRowActions from './EmailRowActions';
import EmailSummaryDrawer from './EmailSummaryDrawer';

/** One row of the mail list: sender, category, subject preview, actions, plus the summary drawer. */
const DisplayEmail = ({ email }) => {
  const navigate = useNavigate();
  const row = useEmailRow(email);
  const { isDraft, isSent, partyName, senderName } = getParty(email);

  const categoryColor = getRandomColor(email.category || 'Miscellaneous');

  return (
    <Box sx={{ borderBottom: '1px solid #f1f5f9' }}>
      <EmailRow
        onClick={() => {
          if (isDraft) return row.openDraft();
          row.markAsRead();
          navigate(routes.view.path, { state: { email: { ...email, is_read: true } } });
        }}
        role="button"
        tabIndex={0}
        // Read mail is tinted (like Gmail); unread stays white with a blue marker
        sx={{
          backgroundColor: row.isUnread ? '#ffffff' : '#f8fafc',
          boxShadow: row.isUnread ? 'inset 3px 0 0 #2563eb' : 'none',
        }}
      >
        <EmailRowSender
          isSent={isSent}
          isStarred={row.isStarred}
          isUnread={row.isUnread}
          senderName={senderName}
          avatarLetter={partyName[0]?.toUpperCase() || 'U'}
          onToggleStar={row.toggleStar}
        />

        {/* Middle: Category Pill & Subject Preview */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, px: 2 }}>
          <CategoryPill color={categoryColor}>
            {email.category || 'Miscellaneous'}
          </CategoryPill>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, overflow: 'hidden' }}>
            <Typography
              component="span"
              sx={{
                fontWeight: row.isUnread ? 700 : 500,
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

        <EmailRowActions
          isSent={isSent}
          isUnread={row.isUnread}
          showSummary={row.summary.show}
          attachname={email.attachname}
          dateDisplay={formatEmailDate(email.received_date)}
          fullTimestamp={formatFullTimestamp(email.received_date)}
          onToggleRead={row.toggleRead}
          onToggleSummary={row.summary.toggle}
        />
      </EmailRow>

      <EmailSummaryDrawer
        show={row.summary.show}
        loading={row.summary.loading}
        text={row.summary.text}
        onClose={row.summary.hide}
      />
    </Box>
  );
};

export default DisplayEmail;
