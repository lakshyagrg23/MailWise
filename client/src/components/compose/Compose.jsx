import React, { useContext } from 'react';
import { Paper, Slide, Typography } from '@mui/material';
import { emailContext } from '../../context/emailContext';
import { FONT } from './constants';
import { useCompose } from './useCompose';
import ComposeTitleBar from './ComposeTitleBar';
import ComposeFields from './ComposeFields';
import ComposeActionBar from './ComposeActionBar';
import AiAssistDialog from './AiAssistDialog';

const Compose = ({ openDialog, setOpenDialog }) => {
  const { setOpenAi } = useContext(emailContext);
  const c = useCompose({ openDialog, setOpenDialog });

  return (
    <>
      <Slide direction="up" in={!!openDialog} mountOnEnter unmountOnExit>
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            // Centered via auto margins, not a transform: Slide owns `transform` on this element
            left: c.expanded ? 0 : 'auto',
            right: c.expanded ? 0 : { xs: 0, sm: 24 },
            mx: c.expanded ? 'auto' : 0,
            bottom: 0,
            width: c.expanded ? 'min(860px, 96vw)' : { xs: '100%', sm: 560 },
            height: c.minimized ? 'auto' : c.expanded ? '78vh' : { xs: '100%', sm: 560 },
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
          <ComposeTitleBar
            title={c.title}
            statusText={c.statusText}
            saveState={c.saveState}
            minimized={c.minimized}
            expanded={c.expanded}
            onBarClick={() => c.minimized && c.setMinimized(false)}
            onToggleMinimize={() => c.setMinimized((m) => !m)}
            onToggleExpand={() => {
              c.setExpanded((x) => !x);
              c.setMinimized(false);
            }}
            onClose={c.closeCompose}
          />

          {!c.minimized && (
            <>
              <ComposeFields
                data={c.data}
                showCc={c.showCc}
                showBcc={c.showBcc}
                onShowCc={() => c.setShowCc(true)}
                onShowBcc={() => c.setShowBcc(true)}
                onChange={c.onValueChange}
              />

              {c.sendError && (
                <Typography
                  sx={{ px: 2, py: 0.75, fontSize: 13, color: '#b91c1c', backgroundColor: '#fef2f2' }}
                >
                  {c.sendError}
                </Typography>
              )}

              <ComposeActionBar
                sending={c.sending}
                canSend={c.canSend}
                saved={c.saveState === 'saved'}
                hasDraft={!!c.data.draftId}
                onSend={c.sendMail}
                onAiAssist={() => setOpenAi(true)}
                onDiscard={c.discard}
              />
            </>
          )}
        </Paper>
      </Slide>

      <AiAssistDialog />
    </>
  );
};

export default Compose;
