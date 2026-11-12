import React from 'react';
import { Typography, CircularProgress, Box } from "@mui/material";

const SuspenseLoader = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#f8fafc',
        gap: 2,
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <CircularProgress size={36} thickness={4} sx={{ color: "#2563eb" }} />
      <Typography sx={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
        Loading MailWise...
      </Typography>
    </Box>
  );
};

export default SuspenseLoader;