"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fullDateLabel } from "@/components/exams/datesheet-date-utils";

export interface SiblingMove {
  id: string;
  className: string;
  subjectName: string;
  newExamDate: string;
  newStartTime: string;
  newEndTime: string;
}

export interface SiblingSkip {
  id: string;
  className: string;
  subjectName: string;
  reason: string;
}

export interface SiblingPreview {
  movable: SiblingMove[];
  skipped: SiblingSkip[];
}

export interface PendingSync {
  subjectId: string;
  subjectName: string;
  kind: "move" | "time";
  examDate: string;
  startTime: string;
  endTime: string;
  preview: SiblingPreview;
}

// Never a forced all-or-nothing choice — "Just this class" reproduces
// exactly the plain single-row update that runs when nothing sibling-related
// is in play at all, so declining to sync is never a degraded path, and
// "Cancel" genuinely does nothing (no request is ever sent for it).
export function SyncSiblingsDialog({
  pending,
  onResolve,
  resolving,
}: {
  pending: PendingSync | null;
  onResolve: (choice: "all" | "just-this" | "cancel") => void;
  resolving: boolean;
}) {
  return (
    <Dialog open={!!pending} onOpenChange={(open) => !open && onResolve("cancel")}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pending?.subjectName} is shared with linked classes</DialogTitle>
        </DialogHeader>
        {pending && (
          <div className="flex flex-col gap-3 text-sm">
            {pending.preview.movable.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-foreground">Will also move for:</span>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {pending.preview.movable.map((m) => (
                    <li key={m.id}>
                      {m.className} — {m.subjectName} to {fullDateLabel(m.newExamDate)} ({m.newStartTime}–{m.newEndTime})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pending.preview.skipped.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-foreground">Won&apos;t move:</span>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {pending.preview.skipped.map((s) => (
                    <li key={s.id}>
                      {s.className} — {s.subjectName}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" disabled={resolving} onClick={() => onResolve("all")}>
            {resolving ? "Moving…" : "Move for all linked classes"}
          </Button>
          <Button className="w-full" variant="outline" disabled={resolving} onClick={() => onResolve("just-this")}>
            Just this class
          </Button>
          <Button className="w-full" variant="ghost" disabled={resolving} onClick={() => onResolve("cancel")}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
