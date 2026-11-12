import React, { useState, useContext, useEffect, useRef } from "react";
import OptionsMenu from "./OptionsMenu";
import SearchResults from "../mail/SearchResults";
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
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import { useNavigate } from "react-router-dom";
import { routes } from "../../routes/route";
import { emailContext } from "../../context/emailContext";

const StyleAppBar = styled(AppBar)`
    background-color: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    position: sticky;
    top: 0;
    z-index: 40;
    box-shadow: none;
`;

const SearchContainer = styled(Box)`
    position: relative;
    display: flex;
    align-items: center;
    background: #f1f5f9;
    border: 1px solid transparent;
    border-radius: 12px;
    padding: 0 8px 0 14px;
    height: 44px;
    width: 100%;
    max-width: 640px;
    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

    &:hover {
        background: #e9eef5;
    }

    &:focus-within {
        background: #ffffff;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12), 0 4px 14px rgba(15, 23, 42, 0.06);
    }
`;

const iconBtn = {
    color: "#475569",
    "&:hover": { backgroundColor: "#f1f5f9", color: "#0f172a" }
};

const Header = ({ toggleDrawer }) => {
    const emailhook = useContext(emailContext);
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [selectedFilterCategory, setSelectedFilterCategory] = useState("All");
    const searchRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // "/" focuses search from anywhere (unless already typing in a field)
    useEffect(() => {
        const onKey = (e) => {
            const tag = e.target?.tagName;
            const typing = tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable;
            if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    // Logo: back to the All Mail list (same route the sidebar's Inbox entry uses) and check for new mail
    const goHome = () => {
        emailhook.setCategory("All");
        setSearchQuery("");
        setShowSearchResults(false);
        navigate(`${routes.email.path}/All`);
        emailhook.refreshMail();
    };

    const handleClearSearch = () => {
        setSearchQuery("");
        setShowSearchResults(false);
        inputRef.current?.focus();
    };

    const filterableCategories = (emailhook.categories || []).filter((c) => c.name !== "All");

    return (
        <StyleAppBar position="sticky" elevation={0}>
            <Toolbar
                sx={{
                    minHeight: "64px",
                    px: { xs: 1.5, sm: 2.5 },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: { xs: 1, sm: 2 }
                }}
            >
                {/* Left: Menu & Brand */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: { md: "240px" } }}>
                    <Tooltip title="Toggle sidebar">
                        <IconButton onClick={toggleDrawer} aria-label="Toggle navigation" sx={iconBtn}>
                            <MenuIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Box
                        component="button"
                        type="button"
                        onClick={goHome}
                        aria-label="MailWise home"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            ml: 0.5,
                            p: 0.5,
                            pr: 1,
                            border: "none",
                            background: "none",
                            borderRadius: 2,
                            cursor: "pointer",
                            userSelect: "none",
                            "&:hover": { backgroundColor: "#f8fafc" },
                            "&:focus-visible": { outline: "2px solid #2563eb", outlineOffset: 2 }
                        }}
                    >
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "9px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#ffffff",
                                background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.35)"
                            }}
                        >
                            <MailOutlineRoundedIcon sx={{ fontSize: 19 }} />
                        </Box>
                        <Typography
                            sx={{
                                display: { xs: "none", sm: "block" },
                                fontSize: "19px",
                                fontWeight: 800,
                                color: "#0f172a",
                                letterSpacing: "-0.5px",
                                fontFamily: "'Inter', sans-serif"
                            }}
                        >
                            Mail<span style={{ color: "#2563eb" }}>Wise</span>
                        </Typography>
                    </Box>
                </Box>

                {/* Center: Search */}
                <Box
                    ref={searchRef}
                    sx={{ flex: 1, display: "flex", justifyContent: "center", position: "relative", maxWidth: "680px" }}
                >
                    <SearchContainer>
                        <SearchIcon sx={{ color: "#64748b", fontSize: 20, mr: 1.25 }} />
                        <InputBase
                            inputRef={inputRef}
                            placeholder="Search mail"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowSearchResults(e.target.value.trim().length > 0);
                            }}
                            onFocus={() => {
                                if (searchQuery.trim().length > 0) setShowSearchResults(true);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    if (searchQuery) handleClearSearch();
                                    else e.target.blur();
                                }
                            }}
                            sx={{
                                width: "100%",
                                fontSize: "14px",
                                fontFamily: "'Inter', sans-serif",
                                color: "#1e293b",
                                "& input::placeholder": { color: "#94a3b8", opacity: 1 }
                            }}
                            inputProps={{ "aria-label": "search emails" }}
                        />

                        {searchQuery ? (
                            <Tooltip title="Clear (Esc)">
                                <IconButton size="small" onClick={handleClearSearch} sx={{ color: "#94a3b8", p: 0.5 }}>
                                    <CloseIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                            </Tooltip>
                        ) : (
                            <Box
                                aria-hidden
                                sx={{
                                    display: { xs: "none", md: "flex" },
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 22,
                                    height: 22,
                                    mr: 0.5,
                                    borderRadius: "6px",
                                    border: "1px solid #cbd5e1",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#94a3b8",
                                    backgroundColor: "#ffffff"
                                }}
                            >
                                /
                            </Box>
                        )}

                        {/* Category scope */}
                        <FormControl size="small" variant="standard" sx={{ ml: 0.5, minWidth: 84 }}>
                            <Select
                                value={selectedFilterCategory}
                                onChange={(e) => setSelectedFilterCategory(e.target.value)}
                                disableUnderline
                                aria-label="Search scope"
                                sx={{
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: "#475569",
                                    px: 1,
                                    borderRadius: "8px",
                                    backgroundColor: "rgba(15, 23, 42, 0.04)",
                                    "& .MuiSelect-select": { py: 0.5, pr: "20px !important" }
                                }}
                            >
                                <MenuItem value="All">All mail</MenuItem>
                                {filterableCategories.map((cat) => (
                                    <MenuItem key={cat.name} value={cat.name}>
                                        {cat.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </SearchContainer>

                    {showSearchResults && (
                        <SearchResults
                            emails={emailhook.emails}
                            searchQuery={searchQuery}
                            setShowSearchResults={setShowSearchResults}
                            category={selectedFilterCategory}
                        />
                    )}
                </Box>

                {/* Right: Refresh & Profile */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        minWidth: { md: "240px" },
                        justifyContent: "flex-end"
                    }}
                >
                    <Tooltip title="Check for new mail">
                        <span>
                            <IconButton
                                onClick={emailhook.refreshMail}
                                disabled={emailhook.refreshing}
                                aria-label="Check for new mail"
                                sx={iconBtn}
                            >
                                <RefreshIcon
                                    sx={{
                                        fontSize: 21,
                                        animation: emailhook.refreshing ? "mwspin 0.9s linear infinite" : "none",
                                        "@keyframes mwspin": { to: { transform: "rotate(360deg)" } }
                                    }}
                                />
                            </IconButton>
                        </span>
                    </Tooltip>

                    <OptionsMenu />
                </Box>
            </Toolbar>
        </StyleAppBar>
    );
};

export default Header;
