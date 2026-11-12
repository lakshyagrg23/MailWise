import React, { useContext } from 'react';
import { Dialog, DialogContent } from '@mui/material';
import { emailContext } from '../../context/emailContext';
import AutoEmail from './AutoEmail';

/** Modal wrapper for the AI Draft Assistant; open state lives in context so Compose can trigger it. */
const AiAssistDialog = () => {
  const { openAi, setOpenAi } = useContext(emailContext);

  return (
    <Dialog
      open={!!openAi}
      onClose={() => setOpenAi(false)}
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
        <AutoEmail />
      </DialogContent>
    </Dialog>
  );
};

export default AiAssistDialog;
