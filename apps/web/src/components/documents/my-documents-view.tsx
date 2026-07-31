"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IssuedDocumentsList } from "./issued-documents-list";
import { useApi } from "@/lib/use-api";

interface DashboardResponse {
  role: string;
  widgets: {
    studentId?: string | null;
    children?: { studentId: string; classId: string; name: string }[];
  };
}

export function MyDocumentsView() {
  const { data, loading } = useApi<DashboardResponse>("/api/dashboard");
  const [selectedChild, setSelectedChild] = useState("");

  const children = data?.widgets.children ?? [];
  useEffect(() => {
    if (!selectedChild && children.length > 0) setSelectedChild(children[0].studentId);
  }, [children, selectedChild]);

  if (loading || !data) return <Skeleton className="h-64 rounded-xl" />;

  if (data.role === "STUDENT") {
    if (!data.widgets.studentId) return null;
    return (
      <Card>
        <IssuedDocumentsList studentId={data.widgets.studentId} />
      </Card>
    );
  }

  if (data.role === "PARENT") {
    if (children.length === 0) return null;
    return (
      <div className="flex flex-col gap-4">
        <div className="w-64">
          <Select
            items={children.map((c) => ({ value: c.studentId, label: c.name }))}
            value={selectedChild}
            onValueChange={(v) => setSelectedChild(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.studentId} value={child.studentId}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedChild && (
          <Card>
            <IssuedDocumentsList studentId={selectedChild} />
          </Card>
        )}
      </div>
    );
  }

  return null;
}
