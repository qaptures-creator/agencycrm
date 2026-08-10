"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(","))];
  return lines.join("\n");
}

export function CsvExportButton({ filename, rows }: { filename: string; rows: Record<string, string | number>[] }) {
  function handleExport() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport} disabled={rows.length === 0}>
      <Download className="size-3.5" />
      Export CSV
    </Button>
  );
}
