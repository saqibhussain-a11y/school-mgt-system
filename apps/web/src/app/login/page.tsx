"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  GraduationCap,
  BookOpen,
  CalendarCheck,
  Wallet,
  Users,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { SchoolDto } from "@sms/shared-types";

// Floating icon tiles for the brand panel — plain divs + lucide icons, no
// external assets, colored purely from the app's own gradient tokens.
const BRAND_TILES = [
  { Icon: GraduationCap, className: "top-[8%] left-[12%] size-16 -rotate-6", delay: "0s" },
  { Icon: BookOpen, className: "top-[20%] right-[10%] size-14 rotate-9", delay: "0.15s" },
  { Icon: CalendarCheck, className: "bottom-[26%] left-[6%] size-14 rotate-3", delay: "0.3s" },
  { Icon: Wallet, className: "bottom-[10%] right-[16%] size-16 -rotate-9", delay: "0.45s" },
  { Icon: Users, className: "top-[46%] left-[42%] size-12 rotate-12", delay: "0.6s" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [schools, setSchools] = useState<SchoolDto[] | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingSchools, setResolvingSchools] = useState(true);

  useEffect(() => {
    apiFetch<SchoolDto[]>("/api/schools")
      .then((result) => {
        setSchools(result);
        if (result.length === 0) {
          setError("No school has been added to the platform yet.");
        } else if (result.length === 1) {
          // Only one school exists — pick it silently, same UX as before
          // multi-school support existed. With 2+, the user must choose.
          setSchoolId(result[0].id);
        }
      })
      .catch(() => setError("Could not reach the API. Is it running on npm run dev:api?"))
      .finally(() => setResolvingSchools(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(schoolId, email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const showSchoolPicker = (schools?.length ?? 0) > 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl bg-card shadow-xl md:min-h-[600px]">
        {/* Brand panel — hidden on small screens */}
        <div
          className="relative hidden w-[44%] shrink-0 overflow-hidden p-10 md:flex md:flex-col md:justify-between"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--primary), var(--chart-4))",
          }}
        >
          <div className="flex items-center gap-2 text-primary-foreground">
            <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
              <GraduationCap className="size-5" />
            </div>
            <span className="font-semibold">School Management System</span>
          </div>

          <div className="relative my-10 flex-1">
            {BRAND_TILES.map(({ Icon, className, delay }, i) => (
              <div
                key={i}
                className={cn(
                  "absolute flex items-center justify-center rounded-2xl bg-white/12 text-primary-foreground shadow-lg ring-1 ring-white/20 backdrop-blur-sm animate-in fade-in zoom-in",
                  className,
                )}
                style={{ animationDelay: delay, animationDuration: "0.6s" }}
              >
                <Icon className="size-1/2" />
              </div>
            ))}
          </div>

          <div className="text-primary-foreground">
            <h2 className="text-2xl font-semibold">Everything your school needs, in one place</h2>
            <p className="mt-2 text-sm text-primary-foreground/80">
              Attendance, fees, exams, transport and more — managed from a single dashboard.
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="relative flex w-full flex-col justify-center px-8 py-10 md:w-[56%] md:px-14">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {showSchoolPicker
              ? "Choose your school and enter your credentials"
              : "Enter your credentials to continue"}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
            {showSchoolPicker && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  School
                </Label>
                <Select
                  items={(schools ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  value={schoolId}
                  onValueChange={(v) => setSchoolId(v ?? "")}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl border-0 bg-accent px-4 text-sm text-accent-foreground">
                    <SelectValue placeholder="Select your school" />
                  </SelectTrigger>
                  <SelectContent>
                    {(schools ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.test"
                className="h-auto rounded-none border-0 border-b border-input bg-transparent px-0 py-2 text-sm focus-visible:border-b-primary focus-visible:ring-0"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-auto rounded-none border-0 border-b border-input bg-transparent px-0 py-2 pr-8 text-sm focus-visible:border-b-primary focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting || resolvingSchools || !schoolId}
              className="h-11 rounded-xl text-sm font-semibold"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
