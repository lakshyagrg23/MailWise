// Curated accessible color palette for categories and user avatars
const categoryColors = {
  essential: "#dc2626",    // Red
  finance: "#059669",      // Emerald
  promotions: "#d97706",   // Amber
  social: "#0284c7",       // Sky Blue
  updates: "#6366f1",      // Indigo
  subscriptions: "#7c3aed",// Purple
  spam: "#e11d48",         // Rose
  career: "#2563eb",       // Blue
  work: "#2563eb",         // Blue
  academics: "#0891b2",    // Cyan
  miscellaneous: "#64748b",// Slate
  all: "#475569"           // Slate
};

const curatedPalette = [
  "#2563eb", "#059669", "#7c3aed", "#d97706",
  "#dc2626", "#0891b2", "#4f46e5", "#c026d3",
  "#0d9488", "#ea580c", "#475569", "#0284c7"
];

/**
 * Returns a consistent, elegant, accessible color for a given category or sender name.
 *
 * @param {string} name - Name of category or sender
 * @returns {string} Hex color code
 */
export const getRandomColor = (name) => {
  if (!name || typeof name !== "string") {
    return "#64748b";
  }

  const normalized = name.trim().toLowerCase();
  if (categoryColors[normalized]) {
    return categoryColors[normalized];
  }

  // Deterministic hash to pick from curated palette
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % curatedPalette.length;
  return curatedPalette[index];
};

export default getRandomColor;
