export const DEFAULT_CATEGORIES = [
    { name: "Essential", description: "Important career, academic, or life updates such as job offers, exam schedules, etc." },
    { name: "Social", description: "Personal communications and social media notifications." },
    { name: "Promotions", description: "Marketing, sales, and product launch announcements." },
    { name: "Updates", description: "Order status, service updates, or time-sensitive event notifications." },
    { name: "Finance", description: "Banking, billing, investment updates." },
    { name: "Subscriptions", description: "Regular newsletters, content updates from subscribed services." },
    { name: "Miscellaneous", description: "Everything else." }
];

/** Names that are built-in views, not classification categories. A user category with one of
 *  these names would be shadowed by the view and could never be displayed. */
const RESERVED = new Set(['all', 'inbox', 'starred', 'sent', 'drafts']);

export const isReservedCategoryName = (name) =>
    typeof name === 'string' && RESERVED.has(name.trim().toLowerCase());

export const MAX_CATEGORY_NAME = 50;
export const MAX_CATEGORY_DESCRIPTION = 500;
