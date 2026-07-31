"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FeeStructureDialog } from "./fee-structure-dialog";
import { GenerateInvoicesDialog } from "./generate-invoices-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { FeeStructure } from "./types";

export function FeeStructuresTab() {
  const { data: structures, loading, refetch } = useApi<FeeStructure[]>("/api/fee-structures");

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/fee-structures/${id}`, { method: "DELETE" });
      toast.success("Fee structure deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete fee structure");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <FeeStructureDialog
          onSaved={refetch}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              New fee structure
            </Button>
          }
        />
      </div>
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !structures || structures.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No fee structures yet. Create one to start generating invoices.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {structures.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.class.name}</TableCell>
                  <TableCell className="capitalize">{s.category}</TableCell>
                  <TableCell>{s.amount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <GenerateInvoicesDialog
                        structure={s}
                        onSaved={refetch}
                        trigger={
                          <Button size="sm" variant="outline">
                            Generate invoices
                          </Button>
                        }
                      />
                      <FeeStructureDialog
                        structure={s}
                        onSaved={refetch}
                        trigger={
                          <Button size="sm" variant="ghost" title="Edit amount">
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                      />
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="ghost" title="Delete">
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                        title="Delete this fee structure?"
                        description="Only possible if no invoices have been generated against it yet."
                        confirmLabel="Delete"
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
