"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { AcademicSession } from "./sessions-tab";

export interface SchoolClass {
  id: string;
  name: string;
  academicSessionId: string;
}

export function ClassesTab({ canManage }: { canManage: boolean }) {
  const { data: sessions } = useApi<AcademicSession[]>("/api/academic-sessions");
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    if (!sessionId && sessions && sessions.length > 0) {
      setSessionId(sessions[0].id);
    }
  }, [sessions, sessionId]);

  const {
    data: classes,
    loading,
    refetch,
  } = useApi<SchoolClass[]>(sessionId ? `/api/classes?academicSessionId=${sessionId}` : null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/classes", {
        method: "POST",
        body: JSON.stringify({ name, academicSessionId: sessionId }),
      });
      toast.success("Class created");
      setOpen(false);
      setName("");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create class");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-56">
          <Select
            items={(sessions ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={sessionId}
            onValueChange={(value) => setSessionId(value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {(sessions ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" disabled={!sessionId} />}>
              <Plus className="size-4" />
              New class
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New class</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="class-name">Name</Label>
                  <Input
                    id="class-name"
                    placeholder="Grade 5"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating…" : "Create class"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !classes || classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No classes in this session yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
