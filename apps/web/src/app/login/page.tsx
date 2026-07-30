"use client";

import { useEffect, useState, type FormEvent } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SchoolDto } from "@sms/shared-types";

export default function LoginPage() {
  const { login } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingSchool, setResolvingSchool] = useState(true);

  useEffect(() => {
    apiFetch<SchoolDto[]>("/api/schools")
      .then((schools) => {
        if (schools.length === 0) {
          setError("No school is set up yet. Run `npm run db:seed` first.");
          return;
        }
        setSchoolId(schools[0].id);
        setSchoolName(schools[0].name);
      })
      .catch(() => setError("Could not reach the API. Is it running on npm run dev:api?"))
      .finally(() => setResolvingSchool(false));
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </div>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            {schoolName ? schoolName : "School Management System"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.test"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-md bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting || resolvingSchool || !schoolId}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
