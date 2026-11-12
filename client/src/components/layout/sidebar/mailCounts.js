// Pure helpers over the stored email list. "All" matches every category.

/** How many emails belong to the category (case-insensitive). */
export const countByCategory = (emails, categoryName) => {
  if (!emails || emails.length === 0) return 0;
  if (categoryName === "All") return emails.length;
  return emails.filter(
    (email) => email.category?.toLowerCase() === categoryName?.toLowerCase()
  ).length;
};

// Sidebar badges show unread mail (is_read === false), not totals
export const countUnread = (emails, categoryName) => {
  if (!emails || emails.length === 0) return 0;
  return emails.filter(
    (email) =>
      email.is_read === false &&
      (categoryName === "All" || email.category?.toLowerCase() === categoryName?.toLowerCase())
  ).length;
};
