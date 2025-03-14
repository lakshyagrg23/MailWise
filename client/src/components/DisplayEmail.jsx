import React from 'react';
import { ListItem, Checkbox, Typography, Box, styled } from "@mui/material";
import { StarBorder, Star } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { routes } from '../routes/route';
import useApi from '../hooks/useApi';
import { API_URLS } from '../api/api.url';

const DisplayEmail = ({email, selectedEmails, setSelectedEmails }) => {
    const toggleService = useApi(API_URLS.starredEmail);
    const navigate = useNavigate();

    // Function to toggle the starred state safely
    const toggleStarred = async () => {
        await toggleService.call({ id: email._id, value: !email.starred });
        setSelectedEmails(prevEmails =>
            prevEmails.map(e => (e._id === email._id ? { ...e, starred: !e.starred } : e))
        );
    };

    const onSelectChange = () => {
        if (selectedEmails.includes(email._id)) {
            setSelectedEmails(prevState => prevState.filter(id => id !== email._id));
        } else {
            setSelectedEmails(prevState => [...prevState, email._id]);
        }
    };

    const reduceEmailBody = (body, maxLength) => (body.length <= maxLength ? body : body.slice(0, maxLength) + "...");
    const truncatedBody = email.body ? reduceEmailBody(email.body, 20) : '';

    // const emailDate = email.date ? new Date(email.date) : new Date(); // Default to current date if invalid

    const Wrapper = styled(Box)({
        padding: '0 0 0 10px',
        background: '#f2f6fc',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        '&>div': {
            display: 'flex',
            width: '100%',
        },
        '& > div > p': {
            fontSize: '14px',
        }
    });

    const Indicator = styled(Typography)({
        fontSize: '12px !important',
        background: '#ddd',
        color: '#222',
        borderRadius: '4px',
        marginRight: '6px',
        padding: '0 4px',
    });

    // const Date = styled(Typography)({
    //     marginLeft: 'auto',
    //     marginRight: 20,
    //     fontSize: 12,
    //     color: '#5F6368'
    // });

    return (
        <Wrapper onClick={() => navigate(routes.view.path, { state: { email } })} 
    sx={{ display: 'flex', alignItems: 'center', padding: '8px' }}
>
    {/* Checkbox - Prevents click propagation */}
    <Checkbox
        size="small"
        checked={selectedEmails.includes(email._id)}
        onChange={(e) => { e.stopPropagation(); onSelectChange(); }} 
    />

    {/* Star / Star Border Icon */}
    {email.starred ? (
        <Star fontSize="small" sx={{ marginRight: 2, color: '#FFF200' }} 
            onClick={(e) => { e.stopPropagation(); toggleStarred(); }} 
        />
    ) : (
        <StarBorder fontSize="small" sx={{ marginRight: 2 }} 
            onClick={(e) => { e.stopPropagation(); toggleStarred(); }} 
        />
    )}

    {/* Email Content Section */}
    <Box display="flex" alignItems="center" flex="1" overflow="hidden">
        {/* Sender Name (Bold) */}
        <Typography sx={{ fontWeight: 'bold', minWidth: '150px' ,maxWidth:'200px' }}>
            {email.sender}
        </Typography>

        {/* Email Details */}
        <Typography 
            sx={{ width: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginLeft: 2 }}
        >
            {email.name}
        </Typography>

        {/* Category Indicator */}
        <Indicator sx={{ marginLeft: 2 }}>
            {email.category}
        </Indicator>

        {/* Subject + Body */}
        <Typography 
            sx={{ marginLeft: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
            {email.subject} {email.body && '-'} {truncatedBody}
        </Typography>
    </Box>
</Wrapper>

    );
};

export default DisplayEmail;
