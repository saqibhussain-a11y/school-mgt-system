"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
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
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SchoolDto } from "@sms/shared-types";

// Doubles as the landing page for a self-service credential invite (see
// notification.service.ts's claimAccountUrl) — same OTP mechanism as an
// ordinary forgot-password request, just triggered by an admin instead of
// the student. Either way this is the only frontend consumer of the
// existing /auth/forgot-password and /auth/reset-password endpoints.
function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [schools, setSchools] = useState<SchoolDto[] | null>(null);
  const [schoolId, setSchoolId] = useState(searchParams.get("schoolId") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<SchoolDto[]>("/api/schools")
      .then((result) => {
        setSchools(result);
        if (result.length === 1) setSchoolId(result[0].id);
      })
      .catch(() => toast.error("Could not reach the API"));
  }, []);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ schoolId, email }) });
      toast.success("If that account can receive a code, we've sent it — check your email.");
      setStep("confirm");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ schoolId, email, otp, newPassword }),
      });
      toast.success("Password set — you can now sign in.");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Invalid or expired code");
    } finally {
      setSubmitting(false);
    }
  }

  const showSchoolPicker = (schools?.length ?? 0) > 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight">
          {step === "request" ? "Set your password" : "Enter your code"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "request"
            ? "Enter your email and we'll send you a one-time code."
            : "Enter the code we emailed you along with your new password."}
        </p>

        {step === "request" ? (
          <form onSubmit={handleRequest} className="mt-6 flex flex-col gap-4">
            {showSchoolPicker && (
              <div className="flex flex-col gap-2">
                <Label>School</Label>
                <Select
                  items={(schools ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  value={schoolId}
                  onValueChange={(v) => setSchoolId(v ?? "")}
                >
                  <SelectTrigger>
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
              <Label htmlFor="fp-email">Email</Label>
              <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={submitting || !schoolId}>
              {submitting ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fp-otp">One-time code</Label>
              <Input id="fp-otp" required maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fp-password">New password</Label>
              <Input
                id="fp-password"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Set password"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep("request")}>
              Back
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
