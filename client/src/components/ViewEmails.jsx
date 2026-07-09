import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Box, Typography, styled, IconButton, Divider, Paper } from '@mui/material';
import { useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { ArrowBack, Delete, Label, Archive, Report, AttachFile } from '@mui/icons-material';
import Emailbody from './Emailbody';
import { emailContext } from "../App";
import { getRandomColor } from '../content/getColor';

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const ViewEmails = () => {
  const { emails, setEmails, accessToken } = useContext(emailContext);
  const { state } = useLocation();
  const { email: initialEmail } = state || {};
  const { openDrawer } = useOutletContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState(initialEmail);
  const [emailBody, setEmailBody] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popupImage, setPopupImage] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  useEffect(() => {
    if (email?.email_id && !emailBody) {
      const fetchEmailData = async () => {
        setLoading(true);
        try {
          const response = await axios.get(`${API_URL}/fetch-email/${email.email_id}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
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
  }, [email, emailBody, accessToken]);

  const deleteEmail = () => {
    if (!email?._id) return;
    setEmails(prev => prev.filter(e => e._id !== email._id));
    navigate(-1);
  };

  const senderName = getSenderName(email.sender || '');

  return (
    <Wrapper style={{ marginLeft: openDrawer ? 250 : 0 }}>
      <ToolbarContainer>
        <LeftToolbar>
          <IconBtn onClick={() => navigate(-1)} title="Back"><ArrowBack /></IconBtn>
          <IconBtn title="Label"><Label /></IconBtn>
          <IconBtn title="Archive"><Archive /></IconBtn>
        </LeftToolbar>
        <RightToolbar>
          <IconBtn onClick={deleteEmail} title="Delete"><Delete /></IconBtn>
          <IconBtn title="Report"><Report /></IconBtn>
        </RightToolbar>
      </ToolbarContainer>

      <Divider sx={{ borderColor: '#ddd', mb: 3 }} />

      <Content>
        <Subject>{email.subject || 'No subject'}</Subject>

        <SenderBox>
          <SenderDetails>
            <SenderName>{senderName}</SenderName>
            <Typography variant="caption" sx={{ color: "rgb(214, 223, 245)"}}>
              {new Date(email.received_date || Date.now()).toLocaleString('en-US')}
            </Typography>
          </SenderDetails>
        </SenderBox>

        <BodyContainer elevation={3}>
          {loading ? (
            <Loading>Retrieving encrypted transmission...</Loading>
          ) : (
            <Emailbody email={{ ...email, body: emailBody }} />
          )}
        </BodyContainer>

        {attachments.length > 0 && (
          <AttachmentBlock>
            <Typography variant="h6" sx={{ color: "#f59e0b", fontWeight: 700 }}>
              <AttachFile sx={{ verticalAlign: "middle", mr: 1, color: "#f59e0b" }} />
              Attachments
            </Typography>
            <Divider sx={{ my: 1, borderColor: "#c4c4c4" }} />
            <AttachmentList>
              {attachments.map((attachment, index) => (
                <AttachmentItem key={index}>
                  <Typography variant="body2" sx={{ color: "#4f46e5", fontWeight: 600 }}>
                    {attachment.filename}
                  </Typography>
                  {isImage(attachment.mimeType) ? (
                    <img
                      src={`data:${attachment.mimeType};base64,${attachment.data}`}
                      alt={attachment.filename}
                      onClick={() => {
                        setPopupImage(`data:${attachment.mimeType};base64,${attachment.data}`);
                        setIsPopupOpen(true);
                      }}
                      style={{
                        maxWidth: '200px',
                        maxHeight: '200px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)',
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  ) : (
                    <DownloadBtn onClick={() => downloadAttachment(attachment)}>Download</DownloadBtn>
                  )}
                </AttachmentItem>
              ))}
            </AttachmentList>
          </AttachmentBlock>
        )}
      </Content>

      {isPopupOpen && (
        <PopupOverlay onClick={() => setIsPopupOpen(false)}>
          <PopupImage
            src={popupImage}
            alt="Preview"
            onClick={e => e.stopPropagation()}
          />
        </PopupOverlay>
      )}
    </Wrapper>
  );
};

const downloadAttachment = (attachment) => {
  const link = document.createElement("a");
  link.href = `data:${attachment.mimeType};base64,${attachment.data}`;
  link.download = attachment.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const isImage = (mimeType) => mimeType.startsWith("image/");

const getSenderName = (sender) => {
  if (!sender) return 'Unknown Sender';
  const match = sender.match(/^([^<]+)<([^>]+)>$/);
  return match ? match[1].trim() : sender.split('@')[0].replace(/[._-]/g, ' ');
};

// Styled Components

// Styling updates only
const Wrapper = styled(Box)({
  width: '100vw',
  height: '100vh',
  background: '#fefefe',
  color: '#1e293b',
  paddingTop: '20px',
  fontFamily: "'DM Sans', 'Work Sans', sans-serif",
  overflowY: 'auto',
  overflowX: 'hidden',
});

const ToolbarContainer = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 40px',
  backgroundColor: '#4f46e5',
  boxShadow: '0 4px 8px rgba(79, 70, 229, 0.3)',
  borderRadius: '0 0 16px 16px',
});

const IconBtn = styled(IconButton)({
  color: '#fefefe',
  transition: 'all 0.25s ease',
  '&:hover': {
    color: '#f59e0b',
    transform: 'scale(1.15)',
  },
});

const Subject = styled(Typography)({
  fontSize: '30px',
  fontWeight: 800,
  color: '#4f46e5',
  marginBottom: '24px',
});

const SenderBox = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  background: '#1d4ed8',
  padding: '16px 22px',
  borderRadius: '14px',
  boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)',
  marginBottom: '20px',
});

const BodyContainer = styled(Paper)({
  padding: '24px',
  background: '#ffffff',
  borderRadius: '20px',
  boxShadow: '0 10px 20px rgba(79, 70, 229, 0.2)',
  transition: 'box-shadow 0.3s ease',
  '&:hover': {
    boxShadow: '0 14px 28px rgba(79, 70, 229, 0.3)',
  },
});

const AttachmentBlock = styled(Box)({
  marginTop: '40px',
  backgroundColor: '#fef3c7',
  padding: '20px',
  borderRadius: '16px',
  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
});

const AttachmentItem = styled('div')({
  textDecoration: 'none',
  border: '2px dashed #10b981',
  padding: '12px',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  boxShadow: '0 4px 8px rgba(16, 185, 129, 0.2)',
  transition: 'all 0.3s',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 14px rgba(16, 185, 129, 0.3)',
  },
});

const DownloadBtn = styled('button')({
  marginTop: '10px',
  padding: '8px 16px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: '#4f46e5',
  color: '#fefefe',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 0.3s ease, transform 0.2s ease',
  '&:hover': {
    backgroundColor: '#4338ca',
    transform: 'scale(1.05)',
  },
});

const PopupOverlay = styled('div')({
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
});

const PopupImage = styled('img')({
  maxWidth: '90%',
  maxHeight: '90%',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
  objectFit: 'contain',
  cursor: 'zoom-out',
});

const LeftToolbar = styled(Box)({
  display: 'flex',
  gap: '14px',
});

const RightToolbar = styled(Box)({
  display: 'flex',
  gap: '14px',
});

const Content = styled(Box)({
  padding: '40px 60px 60px',
  maxWidth: '900px',
  margin: 'auto',
});

const SenderDetails = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

const SenderName = styled(Typography)({
  fontWeight: 700,
  fontSize: '18px',
  color: '#fefefe',
});

const Loading = styled(Typography)({
  fontSize: '16px',
  color: '#6b7280',
  textAlign: 'center',
  padding: '20px',
});

const AttachmentList = styled(Box)({
  display: 'flex',
  gap: '20px',
  flexWrap: 'wrap',
  marginTop: '10px',
});


export default ViewEmails;