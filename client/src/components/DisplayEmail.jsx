import React, { useState } from 'react';
import { Typography, Box, styled } from "@mui/material";
import AttachmentIcon from '@mui/icons-material/Attachment';
import { useNavigate } from 'react-router-dom';
import { routes } from '../routes/route';
import { getRandomColor } from '../content/getColor';
import { motion } from 'framer-motion';

const DisplayEmail = ({ email, allow }) => {
    const navigate = useNavigate();
    const [hovered, setHovered] = useState(false);

    const Wrapper = styled(Box)({
        padding: '14px 18px',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        borderBottom: '1px solid #e0e0e0',
        transition: 'background 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
            background: '#f9f9f9',
            boxShadow: '0px 4px 8px rgba(0,0,0,0.1)',
        },
    });
    
    const Indicator = styled(Typography)({
        fontSize: '12px',
        color: '#fff',
        borderRadius: '4px',
        padding: '4px 8px',
        fontWeight: 'bold',
        display: 'inline-block',
        minWidth: '80px',
        textAlign: 'center',
    });
    
    const Sender = styled(Typography)({
        fontWeight: 'bold',
        color: '#333',
        minWidth: '180px',
        maxWidth: '200px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    });
    
    const SubjectBody = styled(Typography)({
        marginLeft: '10px',
        color: '#444',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flexGrow: 1,
    });

    const AttachmentWrapper = styled(Box)({
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        backgroundColor: '#f1f1f1',
        borderRadius: '4px',
        padding: '4px 8px',
        fontSize: '12px',
        color: '#333',
        maxWidth: '150px', 
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    });

    return (
        <Wrapper
            onMouseEnter={() => setTimeout(()=>{
                setHovered(true)
            },1000)}
            onMouseLeave={() => setHovered(false)}

            //for opening the emails 
            onClick={(e) => {
                if (e.target.type !== 'checkbox' && e.target.tagName !== 'svg') {
                    navigate(routes.view.path, { state: { email } });
                }
            }}
        >
            {/* Hover Tooltip */}
            {hovered && (
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0, ease: 'easeInOut' }}
                    style={{
                        position: 'absolute',
                        top: '-50px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#ffffff',
                        color: 'rgb(71, 82, 233)',
                        padding: '10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        boxShadow: '0px 4px 8px rgba(0,0,0,0.2)',
                        zIndex: 999,
                    }}
                >
                    {email.emailsummary}
                </motion.div>
            )}

            <Box display="flex" alignItems="center" flex="1" overflow="hidden">
                {/* Sender */}
                <Sender>
                    {email.sender.includes('<') ? email.sender.split('<')[0].trim() : email.sender}
                </Sender>
    
                {/* Category Badge */}
                <Indicator sx={{ backgroundColor: getRandomColor(email.category), marginLeft: 12 }}>
                    {email.category}
                </Indicator>

                {/* Subject & Body */}
                <SubjectBody dangerouslySetInnerHTML={{ __html: `<strong>${email.subject}</strong>` }} />

                {/* Attachment section */}
                {email.attachname && (
                    <AttachmentWrapper title={email.attachname}>
                        <AttachmentIcon sx={{ fontSize: '16px', color: '#555' }} />
                        <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {email.attachname}
                        </Typography>
                    </AttachmentWrapper>
                )}
            </Box>
        </Wrapper>
    );
};

export default DisplayEmail;
