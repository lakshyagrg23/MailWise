import React from "react";
import { Box, Typography, Avatar, List, ListItem } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { routes } from "../routes/route";
import { getRandomColor } from "../content/getColor";
import dayjs from "dayjs";

const SearchResults = ({ emails, searchQuery, setShowSearchResults, category }) => {
  const navigate = useNavigate();

  if (!searchQuery || !searchQuery.trim()) return null;

  const query = searchQuery.toLowerCase().trim();
  const searchWords = query.split(" ").filter(Boolean);

  const filteredEmails = (emails || []).filter((email) => {
    const matchesCategory = category === "All" || (email.category?.toLowerCase() === category.toLowerCase());
    if (!matchesCategory) return false;

    const subject = (email.subject || "").toLowerCase();
    const sender = (email.sender || "").toLowerCase();
    const body = (email.body || email.emailsummary || "").toLowerCase();

    return searchWords.every(word => subject.includes(word) || sender.includes(word) || body.includes(word));
  });

  const handleSelectEmail = (email) => {
    setShowSearchResults(false);
    navigate(routes.view.path, { state: { email } });
  };

  return (
    <Box
      sx={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        right: 0,
        backgroundColor: "#ffffff",
        borderRadius: 2.5,
        border: "1px solid #e2e8f0",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.12)",
        maxHeight: "380px",
        overflowY: "auto",
        zIndex: 100,
        p: 1.5,
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 0.8, borderBottom: "1px solid #f1f5f9" }}>
        <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Search Results
        </Typography>
        <Typography sx={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>
          {filteredEmails.length} {filteredEmails.length === 1 ? "match" : "matches"}
        </Typography>
      </Box>

      {/* Results List */}
      {filteredEmails.length > 0 ? (
        <List sx={{ p: 0, mt: 0.5 }}>
          {filteredEmails.map((email) => {
            const senderRaw = email.sender || "Unknown";
            const senderName = senderRaw.includes("<") ? senderRaw.split("<")[0].replace(/['"]/g, "").trim() : senderRaw;
            const categoryColor = getRandomColor(email.category || "Miscellaneous");
            const dateDisplay = email.received_date ? dayjs(email.received_date).format("MMM D") : "";

            return (
              <ListItem
                key={email.email_id || email.id}
                onClick={() => handleSelectEmail(email)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 1.2,
                  borderRadius: 1.5,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                  "&:hover": { backgroundColor: "#f8fafc" },
                  gap: 1.5
                }}
              >
                {/* Left: Avatar & Details */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, minWidth: 0, flex: 1 }}>
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: getRandomColor(senderName),
                      color: "#ffffff"
                    }}
                  >
                    {senderName[0]?.toUpperCase() || "U"}
                  </Avatar>

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>
                        {senderName}
                      </Typography>
                      <Box
                        sx={{
                          fontSize: "10px",
                          fontWeight: 700,
                          px: 0.8,
                          py: 0.2,
                          borderRadius: "9999px",
                          backgroundColor: `${categoryColor}15`,
                          color: categoryColor,
                          textTransform: "uppercase"
                        }}
                      >
                        {email.category}
                      </Box>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: "12.5px",
                        color: "#475569",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {email.subject || "(No Subject)"}
                    </Typography>
                  </Box>
                </Box>

                {/* Right: Date */}
                <Typography sx={{ fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {dateDisplay}
                </Typography>
              </ListItem>
            );
          })}
        </List>
      ) : (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography sx={{ fontSize: "13.5px", color: "#64748b" }}>
            No emails matching "{searchQuery}"
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SearchResults;
