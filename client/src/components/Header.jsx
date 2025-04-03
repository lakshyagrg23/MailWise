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
} from "@mui/material";
import { motion } from "framer-motion";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import { emailContext } from "../App";

const StyleAppBar = styled(AppBar)`
    background: rgb(255, 255, 255);
    box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
    transition: background 0.5s ease-in-out;
`;

const BrandName = styled(motion(Typography))`
    font-size: 26px;
    font-weight: 600;
    color: rgb(71, 82, 233);
    margin-left: 15px;
    font-family: "Product Sans", Arial, sans-serif;
    cursor: pointer;
    user-select: none;
    transition: transform 0.3s ease-in-out;
    &:hover {
        transform: scale(1.1);
        text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.7);
    }
`;

const SearchWrapper = styled(motion.div)`
    background: rgb(244, 244, 243);
    margin-left: 80px;
    border-radius: 24px;
    min-width: 600px;
    max-width: 720px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    position: relative;
    backdrop-filter: blur(5px);
    transition: all 0.4s ease-in-out;
    &:hover {
        box-shadow: 0px 0px 12px rgba(255, 255, 255, 0.4);
        transform: scale(1.02);
    }
    & > div {
        width: 100%;
    }
`;

const OptionsWrapper = styled(Box)`
    width: 100%;
    display: flex;
    justify-content: end;
    align-items: center;
    gap: 15px;
`;

const Header = ({ toggleDrawer }) => {
    const { emails } = useContext(emailContext);
    const nav = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearchResults, setShowSearchResults] = useState(false);
    const searchContainerRef = useRef(null);

    // Handle click outside to close search results
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <StyleAppBar position="static">
            <Toolbar>
                <motion.div
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 300 }}
                >
                    <IconButton onClick={toggleDrawer}>
                        <MenuIcon style={{ color: "rgb(71, 82, 233)" }} />
                    </IconButton>
                </motion.div>

                <BrandName
                    variant="h6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                    onClick={() => nav("/emails")}
                >
                    MailWise
                </BrandName>

                <div ref={searchContainerRef} className="relative">
                    <SearchWrapper
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <SearchIcon style={{ color: "rgb(71, 82, 233)" }} />
                        <InputBase
                            placeholder="Search Mail..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowSearchResults(e.target.value.length > 0);
                            }}
                            style={{ color: "rgb(71, 82, 233)" }}
                        />
                    </SearchWrapper>

                    {/* Search Results (Only shown when searchQuery is active) */}
                    {showSearchResults && (
                        <SearchResults
                            emails={emails}
                            searchQuery={searchQuery}
                            setShowSearchResults={setShowSearchResults}
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
