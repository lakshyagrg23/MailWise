import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { useRouteError, useNavigate } from "react-router-dom";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const Error = () => {
    const error = useRouteError();
    const navigate = useNavigate();
    console.error("Router error:", error);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                px: 3,
                textAlign: 'center',
                fontFamily: "'Inter', sans-serif"
            }}
        >
            <Box
                sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: '#fef2f2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    border: '1px solid #fee2e2'
                }}
            >
                <ErrorOutlineIcon sx={{ fontSize: 26, color: '#dc2626' }} />
            </Box>

            <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
                Something went wrong
            </Typography>

            <Typography sx={{ fontSize: '13.5px', color: '#64748b', maxWidth: '400px', mb: 3 }}>
                An unexpected error occurred while loading this page. You can return to the inbox or refresh.
            </Typography>

            <Button
                variant="contained"
                onClick={() => navigate('/emails/All')}
                sx={{
                    backgroundColor: '#2563eb',
                    borderRadius: 2,
                    fontWeight: 600,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': { backgroundColor: '#1d4ed8' }
                }}
            >
                Return to Inbox
            </Button>
        </Box>
    );
};

export default Error;