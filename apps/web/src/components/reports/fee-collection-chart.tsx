"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButtons } from "./export-buttons";
import { useApi } from "@/lib/use-api";
import { useChartColors } from "@/lib/chart-colors";
interface ClassOption {
  id: string;
  name: string;
}

interface FeeCollectionPoint {
  month: string;
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
}

export function FeeCollectionChart({ classes }: { classes: ClassOption[] }) {
  const [classId, setClassId] = useState("");
  const colors = useChartColors();

  const params = new URLSearchParams();
  if (classId) params.set("classId", classId);
  const path = `/api/reports/fee-collection-trend?${params.toString()}`;
  const { data, loading } = useApi<FeeCollectionPoint[]>(path);

  const totalOutstanding = data?.reduce((s, d) => s + d.totalOutstanding, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          items={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
          value={classId}
          onValueChange={(v) => setClassId(v ?? "")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ExportButtons path={path} filenameBase="fee-collection-trend" />
      </div>

      <div className="sm:w-64">
        <StatCard label="Total outstanding" value={totalOutstanding} icon={Wallet} tone={totalOutstanding > 0 ? "warning" : "good"} />
      </div>

      {loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No invoiced fees for this filter yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="h-80 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="totalInvoiced" name="Invoiced" fill={colors.series1} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalCollected" name="Collected" fill={colors.series2} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalOutstanding" name="Outstanding" fill={colors.series3} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Invoiced</TableHead>
                  <TableHead>Collected</TableHead>
                  <TableHead>Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell>{row.totalInvoiced}</TableCell>
                    <TableCell>{row.totalCollected}</TableCell>
                    <TableCell>{row.totalOutstanding}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
