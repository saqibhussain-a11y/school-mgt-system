"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bus } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { StudentRoute } from "./types";

interface DashboardResponse {
  role: string;
  widgets: {
    studentId?: string | null;
    children?: { studentId: string; classId: string; name: string }[];
  };
}

function StudentTransport({ studentId }: { studentId: string }) {
  const { data: assignment, loading } = useApi<StudentRoute | null>(`/api/student-routes/student/${studentId}`);

  if (loading) return <Skeleton className="h-40 rounded-xl" />;
  if (!assignment) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Not assigned to a transport route yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex items-start gap-4 py-6">
        <Bus className="mt-1 size-8 text-muted-foreground" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Route</div>
            <div className="text-lg font-semibold">{assignment.route.name}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Vehicle</div>
            <div className="text-lg font-semibold">{assignment.route.vehicle.registrationNo}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Driver</div>
            <div className="text-lg font-semibold">
              {assignment.route.vehicle.driverName}
              <div className="text-sm font-normal text-muted-foreground">{assignment.route.vehicle.driverPhone}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Pickup stop</div>
            <div className="text-lg font-semibold">{assignment.pickupStop || "—"}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MyTransportView() {
  const { data, loading } = useApi<DashboardResponse>("/api/dashboard");
  const [selectedChild, setSelectedChild] = useState("");

  const children = data?.widgets.children ?? [];
  useEffect(() => {
    if (!selectedChild && children.length > 0) setSelectedChild(children[0].studentId);
  }, [children, selectedChild]);

  if (loading || !data) return <Skeleton className="h-64 rounded-xl" />;

  if (data.role === "STUDENT") {
    if (!data.widgets.studentId) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No student profile linked to this account yet.
          </CardContent>
        </Card>
      );
    }
    return <StudentTransport studentId={data.widgets.studentId} />;
  }

  if (data.role === "PARENT") {
    if (children.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No children are linked to your account yet.
          </CardContent>
        </Card>
      );
    }
    const selected = children.find((c) => c.studentId === selectedChild);
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
        {selected && <StudentTransport studentId={selected.studentId} />}
      </div>
    );
  }

  return null;
}
