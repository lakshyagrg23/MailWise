import { useState, useCallback } from "react";

const PREFS_KEY = "mailwise_sidebar_v1";

// `order` is the user's manual order of unpinned categories (set by drag-and-drop / Alt+arrows)
const defaultPrefs = { usage: {}, pinned: [], order: [], filteredOpen: false, moreOpen: false };

const loadPrefs = () => {
  try {
    return { ...defaultPrefs, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) };
  } catch {
    return defaultPrefs;
  }
};

/**
 * Sidebar preferences (pins, manual order, usage counts, collapsed sections), persisted in
 * localStorage. Returns [prefs, updatePrefs]; updatePrefs takes a patch object or an updater fn.
 */
export const useSidebarPrefs = () => {
  const [prefs, setPrefs] = useState(loadPrefs);

  const updatePrefs = useCallback((patch) => {
    setPrefs((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: preferences last for this session only */
      }
      return next;
    });
  }, []);

  return [prefs, updatePrefs];
};
