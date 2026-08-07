"use client";

import { useState, type FormEvent } from "react";
import { ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";

// Deliberately unlinked from anywhere in the app — the super admin is the
// platform owner, not a school user, so this doesn't show a school picker
// and isn't reachable from the public /login page's dropdown. Same
// split-panel design as /login (see that file) so the two feel like one
// product, not a bolted-on admin tool — only the form panel's copy and the
// missing school picker differ.
export default function PlatformLoginPage() {
  const { platformLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await platformLogin(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl bg-card shadow-xl md:min-h-[600px]">
        {/* Brand panel — identical to /login's, so platform sign-in still
            feels like the same product. */}
        <div className="relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#14306b] to-[#081226] p-10 md:flex">
          <div className="relative flex flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- a
                static public-folder brand asset, not an optimizable
                content image */}
            <img
              src="/Logo.png"
              alt="School Management System"
              className="h-64 w-64 rounded-full object-cover drop-shadow-2xl"
            />
          </div>

          <div className="relative">
            <h2 className="text-2xl font-semibold text-white">Everything your school needs, in one place</h2>
            <p className="mt-2 text-sm text-white/80">
              Attendance, fees, exams, transport and more — managed from a single dashboard.
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="relative flex w-full flex-col justify-center px-8 py-10 md:w-[56%] md:px-14">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Platform sign in</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Owner access only</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
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

            <Button type="submit" disabled={submitting} className="h-11 rounded-xl text-sm font-semibold">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
