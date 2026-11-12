// `emailsummary` holds either a short snippet or a Gemini summary. A Gemini summary is recognised by
// its bullet or "Action Item:" line (the server's summarizeEmail.js uses the same convention).
// Keep this in sync with the server until a dedicated column replaces the convention.
export const isAiSummary = (text) =>
  !!text && (text.includes('•') || text.includes('Action Item:'));
