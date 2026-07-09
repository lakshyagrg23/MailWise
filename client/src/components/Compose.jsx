
import React, { useState, useContext,useEffect } from 'react';
import axios from 'axios';
import { Dialog,DialogContent,DialogActions, Typography, styled, TextField, Button, IconButton, Slide } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { emailContext } from '../App';
import Auto_email from './Auto_email';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const DialogContainer = styled(Dialog)`
  .MuiPaper-root {
    border-radius: 20px;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.8); /* dark glass */
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(30px);
    animation: cosmicSlide 0.4s ease;
    width: 95%;
    max-width: 900px;
  }

  @keyframes cosmicSlide {
    from {
      transform: translateY(100px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const Header = styled('div')`
  background: linear-gradient(90deg, #3f51b5, #9c27b0);
  color: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  font-size: 18px;
  letter-spacing: 0.5px;
`;

const Footer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const RecipientWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
`;

const StyledTextField = styled(TextField)`
  input, textarea {
    color: white;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 12px;
  }

  .MuiInputBase-root {
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(5px);
    color: white;
  }

  .MuiOutlinedInput-notchedOutline {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .MuiInputLabel-root {
    color: rgba(255, 255, 255, 0.4);
  }
`;

const SendButton = styled(Button)`
  background: linear-gradient(to right, #00c6ff, #0072ff);
  color: white;
  font-weight: 600;
  border-radius: 9999px;
  padding: 10px 30px;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(to right, #0072ff, #00c6ff);
    transform: scale(1.05);
    box-shadow: 0 0 15px rgba(0, 123, 255, 0.6);
  }
`;

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiPaper-root': {
    background: 'linear-gradient(135deg, #1f1c2c 0%, #928DAB 100%)',
    color: '#fff',
    transition: 'all 0.5s ease-in-out',
    borderRadius: '1rem',
    boxShadow: '0 0 30px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(10px)',
  },
}));

const Compose = ({ openDialog, setOpenDialog }) => {
  const hook = useContext(emailContext);

  const onValueChange = (e) => {
    hook.setData({ ...hook.data, [e.target.name]: e.target.value });
  };

  const handleClose = () => {
    hook.setOpenAi(false);
  };

  const closeComposeClick = (e) => {
    e.preventDefault();
    const payload = {
      to: hook.data.to,
      from: "luckygovindrao182@gmail.com",
      subject: hook.data.subject || "",
      body: hook.data.body || "",
      date: new Date(),
      image: " ",
      name: "lucky",
      starred: false,
      type: "drafts",
    };
    saveDraft.call(payload);
    if (!saveDraft.error) {
      setOpenDialog(false);
      hook.setData({});
    }
  };

  const sendMail = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/email/send-emails`, {
        params: { access_token: hook.accessToken },
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hook.data),
      });
      if (response.request.status === 200) {
        hook.setmessageSent(true);
        hook.setData([]);
        setOpenDialog(false);
      } else {
        console.error("Failed to send email:", response.data.message);
      }
    } catch (err) {
      console.error("Sending mail error:", err);
    }
  };

  return (
    <DialogContainer open={openDialog} TransitionComponent={Transition}>
      <Header>
        <Typography variant="subtitle1">📡 New Transmission</Typography>
        <IconButton onClick={closeComposeClick}>
          <CloseIcon sx={{ color: "white" }} />
        </IconButton>
      </Header>

      <RecipientWrapper>
        <StyledTextField
          fullWidth
          placeholder="To"
          name="to"
          onChange={onValueChange}
        />
        <StyledTextField
          fullWidth
          placeholder="Subject"
          name="subject"
          onChange={onValueChange}
          value={hook.data.subject}
        />
        <StyledTextField
          fullWidth
          multiline
          minRows={10}
          placeholder="Compose your galactic message..."
          name="body"
          onChange={onValueChange}
          value={hook.data.body}
        />
      </RecipientWrapper>

      <Footer>
        <SendButton onClick={sendMail}>🚀 Send</SendButton>
        <SendButton onClick={() => hook.setOpenAi(true)}>✨ Auto-mail</SendButton>
        <IconButton onClick={() => setOpenDialog(false)}>
          <DeleteOutlineOutlinedIcon sx={{ color: "white" }} />
        </IconButton>
      </Footer>

      <Dialog open={hook.openAi} onClose={handleClose}>
      <DialogContent
  sx={{
    background: 'linear-gradient(135deg, #1f1c2c 0%, #928DAB 100%)',
    color: 'white',
    transition: 'all 0.5s ease-in-out',
    borderRadius: '0.75rem',
    boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(8px)',
  }}
>
  <Auto_email />
</DialogContent>

<DialogActions
  sx={{
    background: 'linear-gradient(135deg, #1f1c2c 0%, #928DAB 100%)',
    borderBottomLeftRadius: '0.75rem',
    borderBottomRightRadius: '0.75rem',
    transition: 'background 0.5s ease',
  }}
>
  <Button
    onClick={handleClose}
    color="secondary"
    variant="outlined"
    sx={{
      color: 'white',
      borderColor: 'white',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: '#fff',
      },
      transition: 'all 0.3s ease-in-out',
    }}
  >
    Cancel
  </Button>
</DialogActions>

      </Dialog>
    </DialogContainer>
  );
};

export default Compose;
