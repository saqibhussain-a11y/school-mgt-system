"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BookDialog } from "./book-dialog";
import { IssueBookDialog } from "./issue-book-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Book } from "./types";

export function BooksTab() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  const { data: books, loading, refetch } = useApi<Book[]>(`/api/library-books?${params.toString()}`);

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/library-books/${id}`, { method: "DELETE" });
      toast.success("Book deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete book");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          placeholder="Search by title, author, or ISBN"
          className="w-64"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <BookDialog
          onSaved={refetch}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Add book
            </Button>
          }
        />
      </div>
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !books || books.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No books in the catalog yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Available</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {books.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/library/books/${b.id}`)}>
                  <TableCell className="font-medium">{b.title}</TableCell>
                  <TableCell>{b.author}</TableCell>
                  <TableCell className="text-muted-foreground">{b.category || "—"}</TableCell>
                  <TableCell>
                    {b.availableCopies} / {b.totalCopies}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <IssueBookDialog
                        book={b}
                        onIssued={refetch}
                        trigger={
                          <Button size="sm" variant="outline" disabled={b.availableCopies === 0}>
                            Issue
                          </Button>
                        }
                      />
                      <BookDialog
                        book={b}
                        onSaved={refetch}
                        trigger={
                          <Button size="sm" variant="ghost" title="Edit">
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
                        title="Delete this book?"
                        description="Only possible if no copies are currently on loan."
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() => handleDelete(b.id)}
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
