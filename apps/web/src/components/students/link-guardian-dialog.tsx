"use client";

import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";

const RELATIONSHIPS = ["FATHER", "MOTHER", "GRANDPARENT", "LEGAL_GUARDIAN", "OTHER"];

export function LinkGuardianDialog({
  studentId,
  onLinked,
}: {
  studentId: string;
  onLinked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [relationshipType, setRelationshipType] = useState("FATHER");
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/students/${studentId}/guardians`, {
        method: "POST",
        body: JSON.stringify({ guardianEmail, relationshipType, isPrimaryContact }),
      });
      toast.success("Guardian linked");
      setOpen(false);
      setGuardianEmail("");
      setIsPrimaryContact(false);
      onLinked();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to link guardian");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserPlus className="size-4" />
        Link guardian
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a guardian</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            The guardian must already have an account — create one under Guardians first.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="guardian-email">Guardian email</Label>
            <Input
              id="guardian-email"
              type="email"
              required
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Relationship</Label>
            <Select
              items={RELATIONSHIPS.map((r) => ({ value: r, label: r.replace("_", " ") }))}
              value={relationshipType}
              onValueChange={(v) => setRelationshipType(v ?? "OTHER")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPrimaryContact}
              onChange={(e) => setIsPrimaryContact(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Primary contact
          </label>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Linking…" : "Link guardian"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
