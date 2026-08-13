"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { applyPalette, getStoredPaletteId } from "@/lib/theme/palettes";

// Always mounted, renders nothing. Re-applies the stored palette's correct
// light/dark variant whenever next-themes flips the `.dark` class —
// without this, toggling dark mode would silently revert to whatever
// palette variant happened to be inline-styled from the last apply.
export function PaletteEffects() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    applyPalette(getStoredPaletteId(), resolvedTheme === "dark" ? "dark" : "light");
  }, [resolvedTheme]);

  return null;
}
