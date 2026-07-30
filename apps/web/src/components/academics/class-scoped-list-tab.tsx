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
import type { SchoolClass } from "./classes-tab";

interface NamedEntity {
  id: string;
  name: string;
  classId: string;
}

export function ClassScopedListTab({
  canManage,
  apiPath,
  entityLabel,
  namePlaceholder,
}: {
  canManage: boolean;
  apiPath: string;
  entityLabel: string;
  namePlaceholder: string;
}) {
  const { data: classes } = useApi<SchoolClass[]>("/api/classes");
  const [classId, setClassId] = useState("");

  useEffect(() => {
    if (!classId && classes && classes.length > 0) {
      setClassId(classes[0].id);
    }
  }, [classes, classId]);

  const {
    data: items,
    loading,
    refetch,
  } = useApi<NamedEntity[]>(classId ? `${apiPath}?classId=${classId}` : null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(apiPath, { method: "POST", body: JSON.stringify({ name, classId }) });
      toast.success(`${entityLabel} created`);
      setOpen(false);
      setName("");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to create ${entityLabel.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-56">
          <Select
            items={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={classId}
            onValueChange={(value) => setClassId(value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {(classes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" disabled={!classId} />}>
              <Plus className="size-4" />
              New {entityLabel.toLowerCase()}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New {entityLabel.toLowerCase()}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="entity-name">Name</Label>
                  <Input
                    id="entity-name"
                    placeholder={namePlaceholder}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating…" : `Create ${entityLabel.toLowerCase()}`}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !items || items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No {entityLabel.toLowerCase()}s in this class yet.
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
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
