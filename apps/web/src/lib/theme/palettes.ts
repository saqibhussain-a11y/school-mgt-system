// A second, independent axis on top of next-themes' light/dark toggle (see
// theme-provider.tsx). Only the ~15 brand-swappable tokens below are ever
// touched — status/chart/destructive stay untouched everywhere, matching
// the rule already documented in globals.css for the shipped default
// palette ("academic-core" here, byte-identical to :root/.dark today).
// popover*/card-foreground are deliberately NOT stored — every existing
// palette in globals.css already just mirrors background/foreground/
// primary/accent/border/ring for those, so they're derived at apply time
// instead of duplicated here. The sidebar's own surface (--sidebar,
// -foreground, -accent, -accent-foreground, -border, -ring) is fixed in
// globals.css and NOT part of this model at all — only --sidebar-primary/
// -primary-foreground (below) still track the chosen palette.
export interface PaletteColors {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  tertiary: string;
  tertiaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  description: string;
  light: PaletteColors;
  dark: PaletteColors;
}

export const DEFAULT_PALETTE_ID = "academic-core";

export const PALETTES: ThemePalette[] = [
  {
    id: "academic-core",
    name: "Academic Core",
    description: "The default look — navy primary with a rust accent.",
    light: {
      background: "#f9fafb",
      foreground: "#0b0b0b",
      card: "#ffffff",
      primary: "#1e40af",
      primaryForeground: "#ffffff",
      secondary: "#e0f2fe",
      secondaryForeground: "#1e40af",
      tertiary: "#882d00",
      tertiaryForeground: "#ffffff",
      muted: "#f0efec",
      mutedForeground: "#6f6e69",
      accent: "#eaf1fb",
      accentForeground: "#184f95",
      border: "rgba(11, 11, 11, 0.1)",
      input: "rgba(11, 11, 11, 0.14)",
      ring: "#1e40af",
    },
    dark: {
      background: "#07080a",
      foreground: "#ffffff",
      card: "#14161c",
      primary: "#3b6fe0",
      primaryForeground: "#ffffff",
      secondary: "#17304f",
      secondaryForeground: "#bee0ff",
      tertiary: "#c2542a",
      tertiaryForeground: "#ffffff",
      muted: "#1b1e25",
      mutedForeground: "#9aa0aa",
      accent: "#16283d",
      accentForeground: "#9ec5f4",
      border: "rgba(255, 255, 255, 0.14)",
      input: "rgba(255, 255, 255, 0.2)",
      ring: "#3b6fe0",
    },
  },
  {
    id: "slate",
    name: "Slate",
    description: "Cool neutral gray-blue with a teal accent — understated and professional.",
    light: {
      background: "#f8fafc",
      foreground: "#0f172a",
      card: "#ffffff",
      primary: "#334155",
      primaryForeground: "#ffffff",
      secondary: "#e2e8f0",
      secondaryForeground: "#1e293b",
      tertiary: "#0f766e",
      tertiaryForeground: "#ffffff",
      muted: "#f1f5f9",
      mutedForeground: "#64748b",
      accent: "#e6f4f2",
      accentForeground: "#0f766e",
      border: "rgba(15, 23, 42, 0.1)",
      input: "rgba(15, 23, 42, 0.14)",
      ring: "#334155",
    },
    dark: {
      background: "#070a0f",
      foreground: "#f1f5f9",
      card: "#151a22",
      primary: "#6b81a0",
      primaryForeground: "#ffffff",
      secondary: "#1e293b",
      secondaryForeground: "#cbd5e1",
      tertiary: "#2dd4bf",
      tertiaryForeground: "#07201d",
      muted: "#1a1f28",
      mutedForeground: "#94a3b8",
      accent: "#16302d",
      accentForeground: "#7fe0d3",
      border: "rgba(255, 255, 255, 0.14)",
      input: "rgba(255, 255, 255, 0.2)",
      ring: "#6b81a0",
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Grounded green primary with a warm amber accent.",
    light: {
      background: "#f8faf8",
      foreground: "#0b1a0f",
      card: "#ffffff",
      primary: "#047857",
      primaryForeground: "#ffffff",
      secondary: "#d1fae5",
      secondaryForeground: "#065f46",
      tertiary: "#b45309",
      tertiaryForeground: "#ffffff",
      muted: "#eef2ee",
      mutedForeground: "#5f6b62",
      accent: "#e4f5ec",
      accentForeground: "#047857",
      border: "rgba(11, 26, 15, 0.1)",
      input: "rgba(11, 26, 15, 0.14)",
      ring: "#047857",
    },
    dark: {
      background: "#070a08",
      foreground: "#f4fbf6",
      card: "#12181a",
      primary: "#34d399",
      primaryForeground: "#06281c",
      secondary: "#0f2e22",
      secondaryForeground: "#a7f3d0",
      tertiary: "#f59e0b",
      tertiaryForeground: "#2a1a03",
      muted: "#171c19",
      mutedForeground: "#9db2a8",
      accent: "#12332a",
      accentForeground: "#6ee7b7",
      border: "rgba(255, 255, 255, 0.14)",
      input: "rgba(255, 255, 255, 0.2)",
      ring: "#34d399",
    },
  },
  {
    id: "amber",
    name: "Amber",
    description: "Warm amber primary with a rose accent — energetic without being loud.",
    light: {
      background: "#fbf9f6",
      foreground: "#1a1206",
      card: "#ffffff",
      primary: "#b45309",
      primaryForeground: "#ffffff",
      secondary: "#fef3c7",
      secondaryForeground: "#92400e",
      tertiary: "#be123c",
      tertiaryForeground: "#ffffff",
      muted: "#f2eee7",
      mutedForeground: "#71675a",
      accent: "#fdf0dd",
      accentForeground: "#92400e",
      border: "rgba(26, 18, 6, 0.1)",
      input: "rgba(26, 18, 6, 0.14)",
      ring: "#b45309",
    },
    dark: {
      background: "#0a0806",
      foreground: "#fdf8f0",
      card: "#191510",
      primary: "#fbbf24",
      primaryForeground: "#2a1a03",
      secondary: "#3a2a0d",
      secondaryForeground: "#fde68a",
      tertiary: "#fb7185",
      tertiaryForeground: "#2a0810",
      muted: "#1d1912",
      mutedForeground: "#b3a690",
      accent: "#332711",
      accentForeground: "#fcd34d",
      border: "rgba(255, 255, 255, 0.14)",
      input: "rgba(255, 255, 255, 0.2)",
      ring: "#fbbf24",
    },
  },
  {
    id: "violet",
    name: "Violet",
    description: "Indigo-violet primary with an amber accent — distinctive and confident.",
    light: {
      background: "#faf9fc",
      foreground: "#160f22",
      card: "#ffffff",
      primary: "#6d28d9",
      primaryForeground: "#ffffff",
      secondary: "#ede9fe",
      secondaryForeground: "#5b21b6",
      tertiary: "#b45309",
      tertiaryForeground: "#ffffff",
      muted: "#f0eef3",
      mutedForeground: "#6c667a",
      accent: "#f1ecfc",
      accentForeground: "#5b21b6",
      border: "rgba(22, 15, 34, 0.1)",
      input: "rgba(22, 15, 34, 0.14)",
      ring: "#6d28d9",
    },
    dark: {
      background: "#09070c",
      foreground: "#f8f6fc",
      card: "#161320",
      primary: "#a78bfa",
      primaryForeground: "#1e1035",
      secondary: "#2c1f4a",
      secondaryForeground: "#ddd6fe",
      tertiary: "#fbbf24",
      tertiaryForeground: "#2a1a03",
      muted: "#1a1622",
      mutedForeground: "#a89fb8",
      accent: "#241b3d",
      accentForeground: "#c4b5fd",
      border: "rgba(255, 255, 255, 0.14)",
      input: "rgba(255, 255, 255, 0.2)",
      ring: "#a78bfa",
    },
  },
];

const STORAGE_KEY = "sms:palette-id";

export function getStoredPaletteId(): string {
  if (typeof window === "undefined") return DEFAULT_PALETTE_ID;
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PALETTE_ID;
}

export function setStoredPaletteId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
}

// Not cleared on logout — same treatment as next-themes' own dark/light
// choice (also untouched by clearApiCache()/logout in auth-context.tsx):
// this is a device/browser appearance preference, not per-account data.
//
// `mode`, when given, comes straight from next-themes' own `resolvedTheme`
// React state — pass it whenever the caller already has it (PaletteEffects,
// the settings page). Falling back to reading the `.dark` class off the DOM
// is a real race: caught live when toggling dark mode showed light-mode
// colors until a full reload — next-themes' own class mutation and this
// effect's re-run aren't guaranteed ordered relative to each other, but
// resolvedTheme itself always reflects the state React just committed.
export function applyPalette(id: string, mode?: "light" | "dark") {
  if (typeof document === "undefined") return;
  const palette = PALETTES.find((p) => p.id === id) ?? PALETTES[0];
  const isDark = mode ? mode === "dark" : document.documentElement.classList.contains("dark");
  const c = isDark ? palette.dark : palette.light;
  const root = document.documentElement.style;

  root.setProperty("--background", c.background);
  root.setProperty("--foreground", c.foreground);
  root.setProperty("--card", c.card);
  root.setProperty("--card-foreground", c.foreground);
  root.setProperty("--popover", c.card);
  root.setProperty("--popover-foreground", c.foreground);
  root.setProperty("--primary", c.primary);
  root.setProperty("--primary-foreground", c.primaryForeground);
  root.setProperty("--secondary", c.secondary);
  root.setProperty("--secondary-foreground", c.secondaryForeground);
  root.setProperty("--tertiary", c.tertiary);
  root.setProperty("--tertiary-foreground", c.tertiaryForeground);
  root.setProperty("--muted", c.muted);
  root.setProperty("--muted-foreground", c.mutedForeground);
  root.setProperty("--accent", c.accent);
  root.setProperty("--accent-foreground", c.accentForeground);
  root.setProperty("--border", c.border);
  root.setProperty("--input", c.input);
  root.setProperty("--ring", c.ring);
  // Sidebar surface tokens are fixed in globals.css, not part of this
  // palette model — only the active-nav-item color still tracks it.
  root.setProperty("--sidebar-primary", c.primary);
  root.setProperty("--sidebar-primary-foreground", c.primaryForeground);
}
