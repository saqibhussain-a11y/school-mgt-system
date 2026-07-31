"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

// Mirrors the app's --chart-1/2/3 CSS tokens (globals.css) — read as hex
// here instead of "var(--chart-1)" because recharts needs a resolvable
// color value up front for its own internals (gradients, legend swatches),
// not just an inline style string. Validated via the dataviz skill's
// validate_palette.js for a 3-series categorical use (CVD ΔE 9.1 light /
// 8.4 dark, normal-vision floor 22.9/19.8 — both clear); light-mode aqua/
// yellow sit under 3:1 surface contrast, which is why every chart below
// also ships a legend, tooltips, and a data table (the relief the skill
// requires instead of color-alone identification).
const CHART_COLORS = {
  light: { series1: "#2a78d6", series2: "#1baf7a", series3: "#eda100" },
  dark: { series1: "#3987e5", series2: "#199e70", series3: "#c98500" },
};

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return CHART_COLORS[mounted && resolvedTheme === "dark" ? "dark" : "light"];
}
