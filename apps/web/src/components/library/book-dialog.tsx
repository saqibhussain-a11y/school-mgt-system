"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Book } from "./types";

export function BookDialog({
  trigger,
  book,
  onSaved,
}: {
  trigger: ReactElement;
  book?: Book;
  onSaved: () => void;
}) {
  const isEdit = Boolean(book);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [isbn, setIsbn] = useState(book?.isbn ?? "");
  const [category, setCategory] = useState(book?.category ?? "");
  const [totalCopies, setTotalCopies] = useState(book ? String(book.totalCopies) : "1");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setAuthor("");
    setIsbn("");
    setCategory("");
    setTotalCopies("1");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        title,
        author,
        isbn: isbn || undefined,
        category: category || undefined,
        totalCopies: Number(totalCopies),
      };
      if (isEdit) {
        await apiFetch(`/api/library-books/${book!.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Book updated");
      } else {
        await apiFetch("/api/library-books", { method: "POST", body: JSON.stringify(body) });
        toast.success("Book added to catalog");
        reset();
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save book");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit book" : "Add book"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bk-title">Title</Label>
            <Input id="bk-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bk-author">Author</Label>
            <Input id="bk-author" required value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-isbn">ISBN (optional)</Label>
              <Input id="bk-isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-category">Category (optional)</Label>
              <Input id="bk-category" placeholder="e.g. Fiction" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bk-copies">Total copies</Label>
            <Input
              id="bk-copies"
              type="number"
              min={1}
              required
              value={totalCopies}
              onChange={(e) => setTotalCopies(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add book"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
