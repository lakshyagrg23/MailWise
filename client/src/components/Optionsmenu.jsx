import React, { useState, useContext } from "react";
import { Box, Typography, Popover, Button, Avatar, styled } from "@mui/material";
import { HelpOutline, AccountCircle } from "@mui/icons-material";
import { motion } from "framer-motion";
import { emailContext } from "../App";

const OptionsWrapper = styled(Box)({
    display: "flex",
    alignItems: "center",
    gap: "15px",
    cursor: "pointer",
});

const AnimatedIcon = styled(motion.div)({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

const PopupContainer = styled(motion.div)({
    padding: "15px",
    width: "280px",
    background: "#fff",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
});

const StyledButton = styled(Button)({
    background: "#4285F4",
    color: "white",
    fontWeight: "bold",
    "&:hover": {
        background: "#357ae8",
    },
});

const OptionsMenu = () => {
    const { emails,name } = useContext(emailContext);
    const [helpAnchor, setHelpAnchor] = useState(null);
    const [accountAnchor, setAccountAnchor] = useState(null);
    const [currentAccount, setCurrentAccount] = useState({
        name: "John Doe",
        email: emails?.[0]?.sender || "user@gmail.com",
        avatar: "https://via.placeholder.com/50",
    });

    const handleHelpClick = (event) => setHelpAnchor(event.currentTarget);
    const handleHelpClose = () => setHelpAnchor(null);

    const handleAccountClick = (event) => setAccountAnchor(event.currentTarget);
    const handleAccountClose = () => setAccountAnchor(null);

    const logout = () => {
        window.location.href = "http://localhost:3000";
    };
    

    return (
        <OptionsWrapper>
            {/* Help Icon */}
            <AnimatedIcon whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                <HelpOutline style={{ color: "rgb(71, 82, 233)" }} onClick={handleHelpClick} />
            </AnimatedIcon>
            <Popover
                open={Boolean(helpAnchor)}
                anchorEl={helpAnchor}
                onClose={handleHelpClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <PopupContainer
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                >
                    <Typography variant="h6" style={{ fontWeight: "bold", textAlign: "center" }}>
                        💡 How to Use EmailWise
                    </Typography>
                    <Typography variant="body2">
                        ✨ <b>Custom Categories:</b> Create your own email categories for better organization.
                    </Typography>
                    <Typography variant="body2">
                        📂 <b>Predefined Categories:</b> Use built-in categories like Promotions, Updates, and Social.
                    </Typography>
                    <Typography variant="body2">
                        🔍 <b>Search Emails:</b> Use the search bar to quickly find any email.
                    </Typography>
                    <StyledButton fullWidth onClick={handleHelpClose}>
                        Got It!
                    </StyledButton>
                </PopupContainer>
            </Popover>

            {/* Account Icon */}
            <AnimatedIcon whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                <AccountCircle style={{ color: "rgb(71, 82, 233)" }} onClick={handleAccountClick} />
            </AnimatedIcon>
            <Popover
                open={Boolean(accountAnchor)}
                anchorEl={accountAnchor}
                onClose={handleAccountClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <PopupContainer
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                >
                    <Box display="flex" alignItems="center" gap="10px">
                        <Avatar src={currentAccount.avatar} />
                        <Box>
                            <Typography variant="h6" style={{ fontWeight: "bold" }}>
                                {name}
                            </Typography>
                            <Typography variant="body2" color="gray">
                                {emails.email_id}
                            </Typography>
                        </Box>
                    </Box>
                    <StyledButton fullWidth onClick={() => logout()}>
                        Logout
                    </StyledButton>
                </PopupContainer>
            </Popover>
        </OptionsWrapper>
    );
};

export default OptionsMenu;
