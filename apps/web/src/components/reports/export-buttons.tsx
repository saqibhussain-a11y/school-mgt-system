"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetchBlob, downloadBlob, ApiError } from "@/lib/api-client";

export function ExportButtons({ path, filenameBase }: { path: string; filenameBase: string }) {
  async function handleExport(format: "csv" | "pdf") {
    try {
      const separator = path.includes("?") ? "&" : "?";
      const blob = await apiFetchBlob(`${path}${separator}format=${format}`);
      downloadBlob(blob, `${filenameBase}.${format}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to export ${format.toUpperCase()}`);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => handleExport("csv")}>
        <Download className="size-4" />
        CSV
      </Button>
      <Button size="sm" variant="outline" onClick={() => handleExport("pdf")}>
        <Download className="size-4" />
        PDF
      </Button>
    </div>
  );
}
