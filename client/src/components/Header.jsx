import React, { useState, useContext, useEffect, useRef } from "react";
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
    Tooltip,
    Select,
    MenuItem,
    FormControl
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import { emailContext } from "../App";
import { Refresh } from "./Refresh";

const StyleAppBar = styled(AppBar)`
    background-color: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    position: sticky;
    top: 0;
    z-index: 40;
    box-shadow: none;
`;

const BrandName = styled(Typography)`
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
    font-family: "Inter", sans-serif;
    margin-left: 8px;
    cursor: pointer;
    user-select: none;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 2px;

    & span {
        color: #2563eb;
    }
`;

const SearchContainer = styled(Box)`
    position: relative;
    display: flex;
    align-items: center;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 0 12px;
    height: 42px;
    width: 100%;
    max-width: 620px;
    transition: all 0.2s ease-in-out;

    &:focus-within {
        background: #ffffff;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
`;

const Header = ({ toggleDrawer }) => {
    const emailhook = useContext(emailContext);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [selectedFilterCategory, setSelectedFilterCategory] = useState("All");
    const searchRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleClearSearch = () => {
        setSearchQuery("");
        setShowSearchResults(false);
    };

    return (
        <StyleAppBar position="sticky" elevation={0}>
            <Toolbar sx={{ minHeight: '64px', px: { xs: 2, sm: 3 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                {/* Left: Menu & Brand */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: { xs: 'auto', md: '220px' } }}>
                    <IconButton
                        onClick={toggleDrawer}
                        aria-label="Toggle navigation"
                        size="small"
                        sx={{ color: '#475569', '&:hover': { backgroundColor: '#f1f5f9' } }}
                    >
                        <MenuIcon fontSize="small" />
                    </IconButton>

                    <BrandName onClick={Refresh} aria-label="MailWise Home">
                        Mail<span>Wise</span>
                    </BrandName>
                </Box>

                {/* Center: Search Bar & Quick Scope Selector */}
                <Box ref={searchRef} sx={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', maxWidth: '680px' }}>
                    <SearchContainer>
                        <SearchIcon sx={{ color: '#64748b', fontSize: 20, mr: 1.5 }} />
                        <InputBase
                            placeholder="Search emails by subject, sender, or content..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowSearchResults(e.target.value.trim().length > 0);
                            }}
                            onFocus={() => {
                                if (searchQuery.trim().length > 0) setShowSearchResults(true);
                            }}
                            sx={{
                                width: '100%',
                                fontSize: '13.5px',
                                fontFamily: "'Inter', sans-serif",
                                color: '#1e293b',
                                '& input::placeholder': { color: '#94a3b8', opacity: 1 }
                            }}
                            inputProps={{ "aria-label": "search emails" }}
                        />

                        {searchQuery && (
                            <IconButton size="small" onClick={handleClearSearch} sx={{ color: '#94a3b8', p: 0.5 }}>
                                <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        )}

                        {/* Inline Category Scope Selector */}
                        <FormControl size="small" variant="standard" sx={{ ml: 1, minWidth: 90 }}>
                            <Select
                                value={selectedFilterCategory}
                                onChange={(e) => setSelectedFilterCategory(e.target.value)}
                                disableUnderline
                                sx={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#475569',
                                    '& .MuiSelect-select': { py: 0, pr: '18px !important' }
                                }}
                            >
                                <MenuItem value="All">All Mail</MenuItem>
                                {emailhook.categories?.filter(c => c.name !== "All").map((cat, idx) => (
                                    <MenuItem key={idx} value={cat.name}>
                                        {cat.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </SearchContainer>

                    {/* Search Results Dropdown */}
                    {showSearchResults && (
                        <SearchResults
                            emails={emailhook.emails}
                            searchQuery={searchQuery}
                            setShowSearchResults={setShowSearchResults}
                            category={selectedFilterCategory}
                        />
                    )}
                </Box>

                {/* Right: Refresh & Profile Menu */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: { xs: 'auto', md: '220px' }, justifyContent: 'flex-end' }}>
                    <Tooltip title="Sync / Refresh">
                        <IconButton
                            size="small"
                            onClick={Refresh}
                            sx={{
                                color: '#475569',
                                border: '1px solid #e2e8f0',
                                borderRadius: 2,
                                p: 1,
                                '&:hover': { backgroundColor: '#f1f5f9', color: '#2563eb' }
                            }}
                        >
                            <RefreshIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>

                    <OptionsMenu />
                </Box>
            </Toolbar>
        </StyleAppBar>
    );
};

export default Header;
