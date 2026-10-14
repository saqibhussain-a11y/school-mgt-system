"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDiaryDate } from "./types";

export function DiaryEntryCard({
  date,
  author,
  content,
  photoUrl,
  badge,
  footer,
  actions,
}: {
  date: string;
  author: { firstName: string; lastName: string };
  content: string;
  photoUrl: string | null;
  badge?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{formatDiaryDate(date)}</span>
              {badge}
            </div>
            <span className="text-xs text-muted-foreground">
              {author.firstName} {author.lastName}
            </span>
          </div>
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        {photoUrl && (
          <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="w-fit">
            {/* Signed, short-lived storage URL — next/image can't optimize it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt="Diary attachment"
              className="max-h-72 rounded-md border object-contain"
              loading="lazy"
            />
          </a>
        )}
        {footer}
      </CardContent>
    </Card>
  );
}
