import React from 'react';
import { Box, Typography, styled, Divider } from '@mui/material';


const Container = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  alignItems: 'center',
  marginTop: 50,
  opacity: 0.8,
});

const StyledDivider = styled(Divider)({
  width: '100%',
  marginTop: 10,
});

const NoMails = () => {
  return (
    <Container>
      <Typography variant="h6">Your inbox is empty</Typography>
      <Typography variant="subtitle1">Mails that don't appear in other tabs will be shown here.</Typography>
      <StyledDivider />
    </Container>
  );
};

export default NoMails;
