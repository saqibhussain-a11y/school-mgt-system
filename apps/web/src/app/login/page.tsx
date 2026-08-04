"use client";

import { useEffect, useState, type FormEvent } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SchoolDto } from "@sms/shared-types";

export default function LoginPage() {
  const { login } = useAuth();
  const [schools, setSchools] = useState<SchoolDto[] | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingSchools, setResolvingSchools] = useState(true);

  useEffect(() => {
    apiFetch<SchoolDto[]>("/api/schools")
      .then((result) => {
        setSchools(result);
        if (result.length === 0) {
          setError("No school is set up yet. Run `npm run db:seed` first.");
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
  const selectedSchoolName = schools?.find((s) => s.id === schoolId)?.name;

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
            {!showSchoolPicker && selectedSchoolName ? selectedSchoolName : "School Management System"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {showSchoolPicker && (
              <div className="flex flex-col gap-2">
                <Label>School</Label>
                <Select
                  items={(schools ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  value={schoolId}
                  onValueChange={(v) => setSchoolId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
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
            <Button type="submit" disabled={submitting || resolvingSchools || !schoolId}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
