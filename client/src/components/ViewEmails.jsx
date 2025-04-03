import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Box, Typography, styled, IconButton, Divider, Paper } from '@mui/material';
import { useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { ArrowBack, Delete, Label, Archive, Report, AttachFile } from '@mui/icons-material';
import { emptyProfilePic } from '../assests/Assest';
import Emailbody from './Emailbody';
import { emailContext } from "../App";
import { getRandomColor } from '../content/getColor';

const API_URL = "http://localhost:5000";

const ViewEmails = () => {
    const { emails, setEmails, accessToken } = useContext(emailContext);
    const { state } = useLocation();
    const { email: initialEmail } = state || {};
    const { openDrawer } = useOutletContext();
    const navigate = useNavigate();
    
    // Local state to store email, body, and attachments
    const [email, setEmail] = useState(initialEmail);
    const [emailBody, setEmailBody] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Fetch email body & attachments when component mounts
    useEffect(() => {
        if (email?.email_id && !emailBody) {
            const fetchEmailData = async () => {
                setLoading(true);
                try {
                    console.log("Fetching email for ID:", email.email_id);
                    console.log(accessToken)
                    const response = await axios.get(`${API_URL}/fetch-email/${email.email_id}`, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    });

                    console.log("API Response:", response.data);
                    
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
        setEmails((prevEmails) => prevEmails.filter((e) => e._id !== email._id));
        navigate(-1);
    };

    // if (!email) {
    //     return (
    //         <EmptyStateWrapper>
    //             <Typography variant="h6">No email selected</Typography>
    //             <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
    //                 Select an email from your inbox to view its content here.
    //             </Typography>
    //             <StyledButton onClick={() => navigate(-1)}>Return to Inbox</StyledButton>
    //         </EmptyStateWrapper>
    //     );
    // }
    
    // Extract sender name from email
    const senderName = getSenderName(email.sender || '');
    
    return (
        <Wrapper 
            style={{
                marginLeft: openDrawer ? 250 : 0, 
                width: '100%',
                transition: 'margin-left 0.3s'
            }}
        >
            <ToolbarContainer>
                <LeftToolbar>
                    <IconButton onClick={() => navigate(-1)} size="medium">
                        <ArrowBack />
                    </IconButton>
                    <IconButton size="medium">
                        <Label />
                    </IconButton>
                    <IconButton size="medium">
                        <Archive />
                    </IconButton>
                </LeftToolbar>
                <RightToolbar>
                    <IconButton onClick={deleteEmail} size="medium">
                        <Delete />
                    </IconButton>
                    <IconButton size="medium">
                        <Report />
                    </IconButton>
                </RightToolbar>
            </ToolbarContainer>
            
            <Divider sx={{ mb: 3 }} />
            
            <ContentContainer>
                <SubjectWrapper>
                    <SubjectText variant="h4">{email.subject || 'No subject'}</SubjectText>
                </SubjectWrapper>

                <SenderInfo>
                    <ProfileImage src={emptyProfilePic} alt="profile" />
                    <SenderDetails>
                        <SenderName>{senderName}</SenderName>
                        <Typography variant="caption" color="textSecondary">
                            {new Date(email.date || Date.now()).toLocaleString('en-US')}
                        </Typography>
                    </SenderDetails>
                </SenderInfo>

                <EmailBodyContainer elevation={0}>
                    {loading ? (
                        <LoadingText>Loading email content...</LoadingText>
                    ) : (
                        <Emailbody email={{ ...email, body: emailBody }} />
                    )}
                </EmailBodyContainer>

                {/* Display Attachments */}
                {attachments.length > 0 && (
                    <AttachmentContainer>
                        <Typography variant="h6">
                            <AttachFile sx={{ verticalAlign: "middle", mr: 1 }} /> Attachments
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <AttachmentList>
                            {attachments.map((attachment, index) => (
                                <AttachmentItem key={index}>
                                    <Typography variant="body2">{attachment.filename}</Typography>
                                    {isImage(attachment.mimeType) ? (
                                        <img 
                                            src={`data:${attachment.mimeType};base64,${attachment.data}`} 
                                            alt={attachment.filename} 
                                            style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px' }} 
                                        />
                                    ) : (
                                        <StyledButton 
                                            onClick={() => downloadAttachment(attachment)}
                                        >
                                            Download
                                        </StyledButton>
                                    )}
                                </AttachmentItem>
                            ))}
                        </AttachmentList>
                    </AttachmentContainer>
                )}
            </ContentContainer>
        </Wrapper>
    );
};

// Function to download attachments
const downloadAttachment = (attachment) => {
    const link = document.createElement("a");
    link.href = `data:${attachment.mimeType};base64,${attachment.data}`;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Function to check if the attachment is an image
const isImage = (mimeType) => mimeType.startsWith("image/");

// Function to extract sender name
const getSenderName = (sender) => {
    if (!sender) return 'Unknown Sender';
    const nameEmailPattern = /^([^<]+)<([^>]+)>$/;
    const match = sender.match(nameEmailPattern);
    return match ? match[1].trim() : sender.split('@')[0].replace(/[._-]/g, ' ');
};

export default ViewEmails;

/* ============ Styled Components ============ */
const AttachmentContainer = styled(Box)(({ theme }) => ({
    marginTop: '20px',
    padding: '10px',
    backgroundColor: '#f1f1f1',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
}));

const AttachmentList = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '10px',
}));

const AttachmentItem = styled('a')(({ theme }) => ({
    display: 'inline-block',
    padding: '8px 12px',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
    textDecoration: 'none',
    color: '#333',
    fontWeight: 'bold',
    '&:hover': {
        backgroundColor: '#e0e0e0',
    },
}));

const StyledButton = styled('button')(({ theme }) => ({
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
    '&:hover': {
        backgroundColor: '#0069d9',
    },
}));


const Wrapper = styled(Box)(({ theme }) => ({
    height: 'calc(100vh - 70px)', // Adjust based on your header height
    padding: '0',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    maxWidth: '1200px',
    margin: '0 auto', // Center the content
}));

const ToolbarContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    backgroundColor: '#ffffff',
}));

const LeftToolbar = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
}));

const RightToolbar = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
}));

const ContentContainer = styled(Box)(({ theme }) => ({
    padding: '0 40px 40px 40px',
    overflow: 'auto',
    flexGrow: 1,
    maxWidth: '900px',
    margin: '0 auto', // Center the content
    width: '100%',
}));

const SubjectWrapper = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '25px',
    paddingTop: '10px',
    flexWrap: 'wrap',
}));

const SubjectText = styled(Typography)(({ theme }) => ({
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    wordBreak: 'break-word',
    marginRight: 'auto',
}));

const CategoryBadge = styled(Box)(({ category }) => ({
    fontSize: '13px',
    background: getRandomColor(category),
    color: '#fff',
    borderRadius: '4px',
    padding: '4px 10px',
    fontWeight: 'bold',
    display: 'inline-block',
    minWidth: '80px',
    textAlign: 'center',
    height: 'fit-content',
}));

const SenderInfo = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    marginBottom: '25px',
    padding: '18px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
}));

const ProfileImage = styled('img')(({ theme }) => ({
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    marginRight: '15px',
    backgroundColor: '#e0e0e0',
    border: '2px solid #d0d0d0',
    objectFit: 'cover',
}));

const SenderDetails = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
}));

const SenderNameRow = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
}));

const SenderName = styled(Typography)(({ theme }) => ({
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '5px',
}));

const EmailBodyContainer = styled(Paper)(({ theme }) => ({
    padding: '30px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    minHeight: '300px',
    maxHeight: 'calc(100vh - 300px)',
    overflow: 'auto',
    border: '1px solid #e0e0e0',
}));

const LoadingText = styled(Typography)(({ theme }) => ({
    padding: '20px',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
}));

const EmptyStateWrapper = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 100px)',
    padding: '20px',
    textAlign: 'center',
}));

const Button = styled('button')(({ theme }) => ({
    marginTop: '20px',
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
    '&:hover': {
        backgroundColor: '#0069d9',
    },
}));