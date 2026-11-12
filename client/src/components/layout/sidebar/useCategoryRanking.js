import { useMemo } from "react";
import { FILTERED, MAILBOXES, VISIBLE_LIMIT } from "./constants";
import { countByCategory } from "./mailCounts";

/**
 * Decides which user categories the sidebar shows and in what order.
 * Order: pinned first; then the user's manual order (drag-and-drop); anything not manually placed
 * yet falls back to most-opened, then most mail.
 * Returns { visible, folded, ranked } (names): `visible` is shown, `folded` sits under "N more",
 * `ranked` is the full order.
 */
export const useCategoryRanking = ({ categories, emails, prefs, activeName }) =>
  useMemo(() => {
    const cats = (categories || [])
      .map((c) => c.name)
      .filter(
        (n) =>
          n &&
          !MAILBOXES.includes(n.toLowerCase()) &&
          !FILTERED.some((f) => f.toLowerCase() === n.toLowerCase())
      );

    const pinned = prefs.pinned.filter((n) => cats.includes(n));
    const unpinned = cats.filter((n) => !pinned.includes(n));
    const manual = prefs.order.filter((n) => unpinned.includes(n));
    const auto = unpinned
      .filter((n) => !manual.includes(n))
      .map((n, i) => ({ n, i, uses: prefs.usage[n] || 0, count: countByCategory(emails, n) }))
      .sort((a, b) => b.uses - a.uses || b.count - a.count || a.i - b.i)
      .map((x) => x.n);
    const rest = [...manual, ...auto];
    const rankedAll = [...pinned, ...rest];

    const room = Math.max(0, VISIBLE_LIMIT - pinned.length);
    let shown = [...pinned, ...rest.slice(0, room)];
    let hidden = rest.slice(room);

    // The open category is never hidden; a lone leftover is shown rather than "1 more"
    const active = hidden.find((n) => n.toLowerCase() === activeName);
    if (active) {
      shown.push(active);
      hidden = hidden.filter((n) => n !== active);
    }
    if (hidden.length === 1) {
      shown.push(hidden[0]);
      hidden = [];
    }
    // Keep the displayed order identical to the ranked order (the open category may have been pulled in)
    shown = rankedAll.filter((n) => shown.includes(n));
    return { visible: shown, folded: hidden, ranked: rankedAll };
  },[categories, emails, prefs.pinned, prefs.order, prefs.usage, activeName]);
