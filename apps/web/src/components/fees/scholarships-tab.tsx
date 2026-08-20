"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ScholarshipDialog } from "./scholarship-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Scholarship } from "./types";

function formatDiscount(s: Scholarship) {
  return s.discountType === "PERCENTAGE" ? `${s.discountValue}%` : s.discountValue;
}

export function ScholarshipsTab() {
  const { data: scholarships, loading, refetch } = useApi<Scholarship[]>("/api/scholarships");

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/scholarships/${id}`, { method: "DELETE" });
      toast.success("Scholarship removed");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove scholarship");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ScholarshipDialog
          onSaved={refetch}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              New scholarship
            </Button>
          }
        />
      </div>
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !scholarships || scholarships.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No scholarships yet. Grant one to auto-apply a discount whenever a tuition invoice is generated for that
            student.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scholarships.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.student.user.firstName} {s.student.user.lastName} ({s.student.admissionNo})
                  </TableCell>
                  <TableCell>{s.student.class.name}</TableCell>
                  <TableCell className="capitalize">{s.category}</TableCell>
                  <TableCell>{formatDiscount(s)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ScholarshipDialog
                        scholarship={s}
                        onSaved={refetch}
                        trigger={
                          <Button size="sm" variant="ghost" title="Edit">
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                      />
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="ghost" title="Remove">
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                        title="Remove this scholarship?"
                        description="Future invoices for this student and category will no longer get the discount. Already-generated invoices are unaffected."
                        confirmLabel="Remove"
                        destructive
                        onConfirm={() => handleDelete(s.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
