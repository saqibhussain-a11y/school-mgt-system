"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Check, LayoutDashboard, Megaphone, RotateCcw, Settings2, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  applyPalette,
  DEFAULT_PALETTE_ID,
  getStoredPaletteId,
  PALETTES,
  setStoredPaletteId,
  type PaletteColors,
  type ThemePalette,
} from "@/lib/theme/palettes";

/* Scoped preview: real components rendered inside a wrapper carrying a
   palette's tokens as inline CSS vars. Tailwind utilities like `bg-primary`
   resolve through globals.css's `@theme inline` -> var(--primary), so these
   inline vars re-skin only this wrapper without touching the real app. */
function scopedVars(c: PaletteColors): CSSProperties {
  return {
    "--background": c.background,
    "--foreground": c.foreground,
    "--card": c.card,
    "--card-foreground": c.foreground,
    "--popover": c.card,
    "--popover-foreground": c.foreground,
    "--primary": c.primary,
    "--primary-foreground": c.primaryForeground,
    "--secondary": c.secondary,
    "--secondary-foreground": c.secondaryForeground,
    "--tertiary": c.tertiary,
    "--tertiary-foreground": c.tertiaryForeground,
    "--muted": c.muted,
    "--muted-foreground": c.mutedForeground,
    "--accent": c.accent,
    "--accent-foreground": c.accentForeground,
    "--border": c.border,
    "--ring": c.ring,
    // Sidebar surface is fixed (see globals.css) and deliberately not
    // overridden here — the preview inherits the real fixed value from the
    // cascade. Only the active-nav-item color still tracks the palette.
    "--sidebar-primary": c.primary,
    "--sidebar-primary-foreground": c.primaryForeground,
  } as CSSProperties;
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1" title={label}>
      <span className="size-5 rounded-md border border-black/10 shadow-sm" style={{ background: color }} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function paletteSwatches(c: PaletteColors) {
  return [
    { color: c.primary, label: "Primary" },
    { color: c.tertiary, label: "Accent" },
    { color: c.background, label: "Surface" },
    { color: c.foreground, label: "Text" },
    { color: c.border.startsWith("rgba") ? c.card : c.border, label: "Border" },
  ];
}

function PreviewShell({ colors }: { colors: PaletteColors }) {
  return (
    <div
      style={scopedVars(colors)}
      className="overflow-hidden rounded-xl border border-border bg-background text-foreground"
    >
      <div className="flex">
        <div className="w-32 shrink-0 border-r border-sidebar-border bg-sidebar p-2.5">
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <span className="flex size-5 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
              R
            </span>
            <span className="text-xs font-semibold leading-none text-sidebar-foreground">SMS</span>
          </div>
          {[
            { label: "Dashboard", icon: LayoutDashboard, active: true },
            { label: "Students", icon: Users, active: false },
            { label: "Announcements", icon: Megaphone, active: false },
          ].map(({ label, icon: Icon, active }) => (
            <div
              key={label}
              className={cn(
                "mb-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] leading-none",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-3" />
              {label}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Welcome back, Admin</p>
            <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              A
            </span>
          </div>

          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground">Today&apos;s attendance</p>
            <p className="text-base font-bold leading-tight text-foreground">92%</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[92%] rounded-full bg-primary" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-foreground">New announcement</p>
              <span className="rounded-full bg-tertiary px-1.5 py-0.5 text-[9px] font-medium text-tertiary-foreground">
                New
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Exam datesheet published for Term 1.</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
              View
            </span>
            <span className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground">
              Dismiss
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaletteCard({
  palette,
  mode,
  isSelected,
  onSelect,
  onHover,
}: {
  palette: ThemePalette;
  mode: "light" | "dark";
  isSelected: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      aria-pressed={isSelected}
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-lg border bg-card p-3.5 text-left transition-all cursor-pointer",
        isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40 hover:shadow-sm",
      )}
    >
      {isSelected && (
        <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
      <div className="pr-6">
        <span className="text-sm font-semibold text-foreground">{palette.name}</span>
      </div>
      <p className="text-xs leading-snug text-muted-foreground">{palette.description}</p>
      <div className="flex items-center gap-2.5 pt-0.5">
        {paletteSwatches(palette[mode]).map((s) => (
          <Swatch key={s.label} color={s.color} label={s.label} />
        ))}
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const mode: "light" | "dark" = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const [selectedId, setSelectedId] = useState(DEFAULT_PALETTE_ID);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(getStoredPaletteId());
  }, []);

  function selectPalette(id: string) {
    setStoredPaletteId(id);
    applyPalette(id, mode);
    setSelectedId(id);
  }

  const preview = PALETTES.find((p) => p.id === (previewId ?? selectedId)) ?? PALETTES[0];
  const isDefault = selectedId === DEFAULT_PALETTE_ID;
  const previewCaption =
    preview.id === selectedId ? "Currently applied" : "Hover to preview, click to apply";

  return (
    <div>
      <PageHeader
        title="Appearance"
        description="Personalize the color palette used across the app. Applied instantly and saved to this browser."
        action={
          <Button variant="outline" size="sm" onClick={() => selectPalette(DEFAULT_PALETTE_ID)} disabled={isDefault}>
            <RotateCcw className="size-3.5" />
            Reset to default
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Color palettes</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PALETTES.map((palette) => (
              <PaletteCard
                key={palette.id}
                palette={palette}
                mode={mode}
                isSelected={selectedId === palette.id}
                onSelect={() => selectPalette(palette.id)}
                onHover={(hovering) => setPreviewId(hovering ? palette.id : null)}
              />
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Preview</h2>
            {mounted && <span className="text-xs text-muted-foreground">{previewCaption}</span>}
          </div>
          <div className="sticky top-4 space-y-3">
            <PreviewShell colors={preview[mode]} />
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {preview.name} · {mode === "dark" ? "Dark" : "Light"} tokens
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2.5">
                {paletteSwatches(preview[mode]).map((s) => (
                  <Swatch key={s.label} color={s.color} label={s.label} />
                ))}
              </CardContent>
            </Card>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Hover a palette to preview it here, then click to apply it app-wide. Your choice is
              stored in this browser and restored on your next visit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
