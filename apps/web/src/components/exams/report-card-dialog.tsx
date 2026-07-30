"use client";

import { useState, type ReactElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReportCardView } from "@/components/exams/report-card-view";

export function ReportCardDialog({
  trigger,
  examId,
  studentId,
  studentName,
}: {
  trigger: ReactElement;
  examId: string;
  studentId: string;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{studentName === "You" ? "Your report card" : `${studentName}'s report card`}</DialogTitle>
        </DialogHeader>
        {open && <ReportCardView examId={examId} studentId={studentId} />}
      </DialogContent>
    </Dialog>
  );
}
