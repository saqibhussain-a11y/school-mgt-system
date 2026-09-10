"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import type { StaffForSalary } from "./types";

function SalaryCell({ staff, onSaved }: { staff: StaffForSalary; onSaved: () => void }) {
  const [value, setValue] = useState(staff.baseSalary != null ? String(staff.baseSalary) : "");
  const [saving, setSaving] = useState(false);
  const dirty = value !== (staff.baseSalary != null ? String(staff.baseSalary) : "");

  async function save() {
    const parsed = Number(value);
    if (!value || Number.isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a base salary greater than 0");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/payroll/staff/${staff.id}/salary`, {
        method: "PATCH",
        body: JSON.stringify({ baseSalary: parsed }),
      });
      toast.success(`Base salary updated for ${staff.user.firstName} ${staff.user.lastName}`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update salary");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min="1"
        step="1"
        className="h-8 w-32"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Not set"
      />
      {dirty && (
        <Button size="sm" variant="outline" className="h-8" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
      )}
    </div>
  );
}

export function SalariesTab() {
  const { data: staff, loading, refetch } = useApi<StaffForSalary[]>("/api/payroll/staff");

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Staff</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Base salary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(staff ?? []).map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">
                {s.user.firstName} {s.user.lastName}
              </TableCell>
              <TableCell>{s.designation}</TableCell>
              <TableCell>
                {s.baseSalary != null && <div className="mb-1 text-xs text-muted-foreground">{formatCurrency(s.baseSalary)}</div>}
                <SalaryCell staff={s} onSaved={refetch} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
