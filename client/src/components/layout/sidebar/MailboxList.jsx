import React from "react";
import { Box } from "@mui/material";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import { routes } from "../../../routes/route";
import NavItem from "./NavItem";

// `name` is both the route segment and the category-context value; "All" is shown as "Inbox"
const MAILBOX_LINKS = [
  { name: "All", label: "Inbox", icon: <InboxOutlinedIcon /> },
  { name: "Starred", label: "Starred", icon: <StarBorderRoundedIcon /> },
  { name: "Sent", label: "Sent", icon: <SendOutlinedIcon /> },
  { name: "Drafts", label: "Drafts", icon: <EditNoteOutlinedIcon /> }
];

/** Inbox / Starred / Sent / Drafts: used constantly, always on top. */
const MailboxList = ({ activeName, inboxUnread, onSelect }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
    {MAILBOX_LINKS.map(({ name, label, icon }) => (
      <NavItem
        key={name}
        to={`${routes.email.path}/${name}`}
        label={label}
        icon={icon}
        count={name === "All" ? inboxUnread : undefined}
        active={activeName === name.toLowerCase()}
        onClick={() => onSelect(name)}
      />
    ))}
  </Box>
);

export default MailboxList;
