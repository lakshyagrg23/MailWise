import React, { useContext } from 'react';
import http from '../api/http';
import {
  Dialog,
  DialogContent,
  Typography,
  styled,
  TextField,
  Button,
  IconButton,
  Slide,
  Box
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { emailContext } from '../App';
import Auto_email from './Auto_email';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const DialogContainer = styled(Dialog)`
  .MuiPaper-root {
    border-radius: 16px;
    overflow: hidden;
    background: #ffffff;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.12);
    border: 1px solid #e2e8f0;
    width: 95%;
    max-width: 780px;
  }
`;

const Header = styled('div')`
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Footer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
`;

const RecipientWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
`;

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
    setOpenDialog(false);
    hook.setData({});
  };

  const sendMail = async (e) => {
    e.preventDefault();
    try {
      const response = await http.post('/email/send-emails', {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hook.data),
      });
      if (response.status === 200 || response.data?.status === 'success') {
        hook.setmessageSent(true);
        hook.setData({});
        setOpenDialog(false);
      } else {
        console.error("Failed to send email:", response.data?.message);
      }
    } catch (err) {
      console.error("Sending mail error:", err);
    }
  };

  return (
    <DialogContainer open={openDialog} TransitionComponent={Transition}>
      <Header>
        <Typography sx={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>
          New Message
        </Typography>
        <IconButton size="small" onClick={closeComposeClick} sx={{ color: "#64748b" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Header>

      <RecipientWrapper>
        <TextField
          fullWidth
          size="small"
          placeholder="Recipients (To)"
          name="to"
          onChange={onValueChange}
          value={hook.data?.to || ''}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              backgroundColor: "#f8fafc",
              fontSize: "14px"
            }
          }}
        />
        <TextField
          fullWidth
          size="small"
          placeholder="Subject"
          name="subject"
          onChange={onValueChange}
          value={hook.data?.subject || ''}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              backgroundColor: "#f8fafc",
              fontSize: "14px"
            }
          }}
        />
        <TextField
          fullWidth
          multiline
          minRows={10}
          placeholder="Write your email here..."
          name="body"
          onChange={onValueChange}
          value={hook.data?.body || ''}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              backgroundColor: "#ffffff",
              fontSize: "14.5px"
            }
          }}
        />
      </RecipientWrapper>

      <Footer>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="contained"
            onClick={sendMail}
            endIcon={<SendIcon sx={{ fontSize: 16 }} />}
            sx={{
              backgroundColor: '#2563eb',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              px: 3,
              boxShadow: 'none',
              '&:hover': { backgroundColor: '#1d4ed8' }
            }}
          >
            Send
          </Button>

          <Button
            variant="outlined"
            onClick={() => hook.setOpenAi(true)}
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 16, color: '#2563eb' }} />}
            sx={{
              borderColor: '#cbd5e1',
              color: '#334155',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              '&:hover': { borderColor: '#2563eb', backgroundColor: '#f8fafc' }
            }}
          >
            AI Draft Assistant
          </Button>
        </Box>

        <IconButton size="small" onClick={closeComposeClick} sx={{ color: "#94a3b8", '&:hover': { color: '#dc2626' } }}>
          <DeleteOutlineOutlinedIcon fontSize="small" />
        </IconButton>
      </Footer>

      {/* AI Draft Assistant Modal */}
      <Dialog
        open={hook.openAi}
        onClose={handleClose}
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1,
            backgroundColor: '#ffffff',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            maxWidth: '600px',
            width: '95%'
          }
        }}
      >
        <DialogContent sx={{ p: 2 }}>
          <Auto_email />
        </DialogContent>
      </Dialog>
    </DialogContainer>
  );
};

export default Compose;
