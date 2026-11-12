import { useState } from "react";

/**
 * Reordering by drag-and-drop (mouse) and Alt + Up/Down (keyboard).
 * `ranked` is the full ordered list of category names; `updatePrefs` persists the result.
 * Returns dndFor(name): the props to spread onto that category's NavItem.
 */
export const useCategoryReorder = ({ ranked, prefs, updatePrefs }) => {
  const [dragName, setDragName] = useState(null);
  const [over, setOver] = useState(null); // { name, pos: "before" | "after" }

  // Put `name` before/after `target`. Landing inside the pinned block pins it; landing
  // below it unpins it, so the pinned group always stays on top.
  const moveCategory = (name, target, pos) => {
    if (!name || name === target) return;
    const without = ranked.filter((n) => n !== name);
    const ti = without.indexOf(target);
    if (ti < 0) return;
    const next = [...without];
    next.splice(pos === "after" ? ti + 1 : ti, 0, name);

    const pinnedSet = new Set(prefs.pinned);
    if (pinnedSet.has(target)) pinnedSet.add(name);
    else pinnedSet.delete(name);

    updatePrefs((p) => ({
      ...p,
      pinned: next.filter((n) => pinnedSet.has(n)),
      order: next.filter((n) => !pinnedSet.has(n))
    }));
  };

  const endDrag = () => {
    setDragName(null);
    setOver(null);
  };

  const dndFor = (name) => ({
    dragging: dragName === name,
    dropPos: over?.name === name ? over.pos : null,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", name);
      setDragName(name);
    },
    onDragOver: (e) => {
      if (!dragName || dragName === name) return;
      e.preventDefault(); // allow drop
      const r = e.currentTarget.getBoundingClientRect();
      const pos = e.clientY < r.top + r.height / 2 ? "before" : "after";
      setOver((prev) => (prev?.name === name && prev.pos === pos ? prev : { name, pos }));
    },
    onDrop: (e) => {
      e.preventDefault();
      moveCategory(dragName, name, over?.name === name ? over.pos : "before");
      endDrag();
    },
    onDragEnd: endDrag,
    onKeyDown: (e) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      const i = ranked.indexOf(name);
      if (e.key === "ArrowUp" && i > 0) moveCategory(name, ranked[i - 1], "before");
      if (e.key === "ArrowDown" && i < ranked.length - 1) moveCategory(name, ranked[i + 1], "after");
    }
  });

  return dndFor;
};
