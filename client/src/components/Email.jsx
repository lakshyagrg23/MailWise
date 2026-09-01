import React, { useEffect, useContext, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Box,
  List,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  Tooltip
} from "@mui/material";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DisplayEmail from "./DisplayEmail";
import NoMails from "./error/NoMails";
import { emailContext } from "../App";
import { motion } from "framer-motion";

const Email = () => {
  const { openDrawer } = useOutletContext();
  const emailhook = useContext(emailContext);

  // Pagination States (Gmail-style)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter emails by active category
  const filteredEmails = useMemo(() => {
    if (!Array.isArray(emailhook.emails)) return [];

    let list = emailhook.category === "All"
      ? emailhook.emails
      : emailhook.emails.filter((email) => email.category?.toLowerCase() === emailhook.category?.toLowerCase());

    return [...list].sort((a, b) => new Date(b.received_date || 0) - new Date(a.received_date || 0));
  }, [emailhook.emails, emailhook.category]);

  // Reset to Page 1 when category or email list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [emailhook.category, emailhook.emails?.length]);

  // Compute pagination slices
  const totalCount = filteredEmails.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const startIdx = totalCount === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endIdx = Math.min(validCurrentPage * pageSize, totalCount);

  const paginatedEmails = useMemo(() => {
    return filteredEmails.slice((validCurrentPage - 1) * pageSize, validCurrentPage * pageSize);
  }, [filteredEmails, validCurrentPage, pageSize]);

  // Auto-dismiss alerts
  useEffect(() => {
    if (emailhook.messageSent) {
      const timer = setTimeout(() => {
        emailhook.setmessageSent(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [emailhook.messageSent]);

  const handlePrevPage = () => {
    if (validCurrentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (validCurrentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: openDrawer ? "calc(100% - 250px)" : "100%",
        marginLeft: openDrawer ? "250px" : 0,
        backgroundColor: "#f8fafc",
        p: { xs: 2, md: 3 },
        transition: 'all 0.3s ease',
        boxSizing: 'border-box'
      }}
    >
      {/* Alert Banners */}
      {emailhook.messageSent && (
        <Alert
          icon={<CheckCircleOutlineIcon fontSize="small" />}
          severity="success"
          sx={{ mb: 2, borderRadius: 2, fontWeight: 500, backgroundColor: "#f0fdf4", color: "#166534" }}
        >
          Email sent successfully.
        </Alert>
      )}

      {/* Main Mail Container */}
      <Box
        sx={{
          backgroundColor: "#ffffff",
          borderRadius: 3,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          overflow: "hidden"
        }}
      >
        {/* Gmail-Style Pagination & Control Toolbar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2.5,
            py: 1.5,
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            flexWrap: "wrap",
            gap: 1.5
          }}
        >
          {/* Left: Category Title & Count */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>
              {emailhook.category || "All"}
            </Typography>
            <Typography sx={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
              ({totalCount} {totalCount === 1 ? "email" : "emails"})
            </Typography>
          </Box>

          {/* Right: Pagination Controls */}
          {totalCount > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {/* Page Size Selector */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                  Per page:
                </Typography>
                <FormControl size="small" variant="standard">
                  <Select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    disableUnderline
                    sx={{
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "#334155",
                      cursor: "pointer",
                      "& .MuiSelect-select": { py: 0.2, pr: "20px !important" }
                    }}
                  >
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={25}>25</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Range Counter (e.g. 1–25 of 84) */}
              <Typography sx={{ fontSize: "13px", color: "#475569", fontWeight: 500, userSelect: "none" }}>
                {startIdx}–{endIdx} of {totalCount}
              </Typography>

              {/* Navigation Buttons */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Tooltip title="Previous page">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handlePrevPage}
                      disabled={validCurrentPage <= 1}
                      sx={{
                        color: validCurrentPage <= 1 ? "#cbd5e1" : "#475569",
                        "&:hover": { backgroundColor: "#f1f5f9" }
                      }}
                    >
                      <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="Next page">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleNextPage}
                      disabled={validCurrentPage >= totalPages}
                      sx={{
                        color: validCurrentPage >= totalPages ? "#cbd5e1" : "#475569",
                        "&:hover": { backgroundColor: "#f1f5f9" }
                      }}
                    >
                      <ChevronRightIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          )}
        </Box>

        {/* Content State: Loading, Email Rows, or Empty State */}
        {!emailhook.loaded ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "400px",
              gap: 2
            }}
          >
            <CircularProgress size={32} thickness={4} sx={{ color: "#2563eb" }} />
            <Typography sx={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>
              Loading emails...
            </Typography>
          </Box>
        ) : paginatedEmails.length > 0 ? (
          <List sx={{ p: 0 }}>
            {paginatedEmails.map((email) => (
              <DisplayEmail key={email.email_id || email.id} email={email} />
            ))}
          </List>
        ) : (
          <Box sx={{ py: 8 }}>
            <NoMails />
          </Box>
        )}

        {/* Bottom Pagination Footer for long lists */}
        {totalCount > pageSize && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              px: 2.5,
              py: 1.5,
              borderTop: "1px solid #f1f5f9",
              backgroundColor: "#ffffff",
              gap: 2
            }}
          >
            <Typography sx={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
              Page {validCurrentPage} of {totalPages}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton
                size="small"
                onClick={handlePrevPage}
                disabled={validCurrentPage <= 1}
                sx={{ color: validCurrentPage <= 1 ? "#cbd5e1" : "#475569" }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={handleNextPage}
                disabled={validCurrentPage >= totalPages}
                sx={{ color: validCurrentPage >= totalPages ? "#cbd5e1" : "#475569" }}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Email;
