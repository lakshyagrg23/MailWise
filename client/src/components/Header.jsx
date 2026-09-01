import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import OptionsMenu from "./Optionsmenu";
import SearchResults from "./SearchResults";
import {
    AppBar,
    Box,
    InputBase,
    Toolbar,
    styled,
    Typography,
    IconButton,
    FormControl,
    Select,
    MenuItem
} from "@mui/material";
import { motion } from "framer-motion";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import { emailContext } from "../App";
import { Refresh } from "./Refresh";

const StyleAppBar = styled(AppBar)`
    background-color: #f5f7fa;  // very light gray background
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); // subtle shadow
    border-bottom: 1px solid #e2e8f0; // subtle border
    position: relative;
    z-index: 1;
`;

const BrandName = styled(motion(Typography))`
    font-size: 28px;
    font-weight: 700;
    color: #2563eb; // accent blue
    font-family: "Inter", sans-serif;
    margin-left: 15px;
    cursor: pointer;
    user-select: none;
    transition: transform 0.2s ease-in-out;

    &:hover {
        transform: scale(1.05);
        color: #3b82f6;
    }
`;

const SearchWrapper = styled(motion.div)`
    background: #fff; // white background for input
    margin-left: 80px;
    border-radius: 30px;
    min-width: 600px;
    max-width: 720px;
    height: 50px;
    display: flex;
    align-items: center;
    padding: 0 20px;
    position: relative;
    border: 1.5px solid #cbd5e1; // subtle border
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease-in-out;
    z-index: 50;

    &:hover {
        border-color: #3b82f6;
        box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
    }

    & > svg {
        color: #2563eb; // blue icon color
        margin-right: 10px;
    }

    & > input {
        font-family: "Inter", sans-serif;
        font-weight: 500;
        font-size: 1rem;
        color: #1e293b;
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
    }
`;

const OptionsWrapper = styled(Box)`
    width: 100%;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 15px;
`;

const StyledFormControl = styled(FormControl)`
    min-width: 150px;
    background: #fff;
    border-radius: 30px;
    padding: 5px 10px;
    border: 1.5px solid #cbd5e1;
    transition: border-color 0.3s ease;

    &:hover {
        border-color: #3b82f6;
    }
`;

const StyledSelect = styled(Select)`
    color: #1e293b;
    font-family: "Inter", sans-serif;
    font-weight: 600;

    & .MuiSelect-icon {
        color: #2563eb;
    }

    & .MuiOutlinedInput-notchedOutline {
        border: none;
    }

    & .MuiMenuItem-root {
        background: #fff;
        color: #1e293b;
        font-family: "Inter", sans-serif;
        font-weight: 500;
        transition: background 0.2s ease;

        &:hover {
            background-color: #bfdbfe; // light blue highlight
            color: #1e293b;
        }
    }
`;

const Header = ({ toggleDrawer }) => {
    const emailhook = useContext(emailContext);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [cat, setCat] = useState("All");
    const searchContainerRef = useRef(null);
    const userId = emailhook.selectedUser || localStorage.getItem("mailwise_user_id");

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <StyleAppBar position="static" elevation={0}>
            <Toolbar>
                <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300 }}
                >
                    <IconButton onClick={toggleDrawer} aria-label="menu" size="large" edge="start">
                        <MenuIcon sx={{ color: "#2563eb" }} />
                    </IconButton>
                </motion.div>

                <BrandName
                    variant="h6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                    onClick={()=>Refresh(emailhook)}
                    aria-label="MailWise Home"
                >
                    MailWise
                </BrandName>

                <div
                    ref={searchContainerRef}
                    className="relative z-50"
                    style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "row",
                        gap: "15px",
                    }}
                >
                    <SearchWrapper
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <SearchIcon />
                        <InputBase
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowSearchResults(e.target.value.length > 0);
                            }}
                            inputProps={{ "aria-label": "search emails" }}
                        />
                    </SearchWrapper>

                    <StyledFormControl variant="outlined" size="small">
                        <StyledSelect
                            labelId="category-label"
                            id="category-select"
                            value={cat}
                            onChange={(e) => setCat(e.target.value)}
                            displayEmpty
                            inputProps={{ "aria-label": "select category" }}
                        >
                            {emailhook.categories.length > 0 ? (
                                emailhook.categories.map((category, index) => (
                                    <MenuItem key={index} value={category.name}>
                                        {category.name}
                                    </MenuItem>
                                ))
                            ) : (
                                <MenuItem value="">
                                    No Categories Available
                                </MenuItem>
                            )}
                        </StyledSelect>
                    </StyledFormControl>

                    {showSearchResults && (
                        <SearchResults
                            emails={emailhook.emails}
                            searchQuery={searchQuery}
                            setShowSearchResults={setShowSearchResults}
                            category={cat}
                        />
                    )}
                </div>

                <OptionsWrapper>
                    <OptionsMenu />
                </OptionsWrapper>
            </Toolbar>
        </StyleAppBar>
    );
};

export default Header;
