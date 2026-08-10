"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { importMembersCsvAction, type CsvImportResult } from "@/actions/gym/memberships";

export type ExportMemberRow = {
  memberNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  joinDate: string;
  planName: string | null;
  billingAmount: number | null;
  paymentFrequency: string | null;
  status: string | null;
  renewalDate: string | null;
};

const SAMPLE_HEADER = "fullName,email,phone,joinDate,planName,billingAmount,paymentFrequency";

function toCsvValue(v: string | number | null | undefined) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
}

export function CsvTools({ members, canManage }: { members: ExportMemberRow[]; canManage: boolean }) {
  const [csvText, setCsvText] = React.useState("");
  const [result, setResult] = React.useState<CsvImportResult | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleExport() {
    const header = [
      "memberNumber",
      "fullName",
      "email",
      "phone",
      "joinDate",
      "planName",
      "billingAmount",
      "paymentFrequency",
      "status",
      "renewalDate",
    ];
    const rows = members.map((m) =>
      [
        m.memberNumber,
        m.fullName,
        m.email,
        m.phone,
        m.joinDate,
        m.planName,
        m.billingAmount,
        m.paymentFrequency,
        m.status,
        m.renewalDate,
      ]
        .map(toCsvValue)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `muscle-massacre-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    if (!csvText.trim()) return;
    startTransition(async () => {
      try {
        const res = await importMembersCsvAction(csvText);
        setResult(res);
        toast.success(`Imported ${res.created} member${res.created === 1 ? "" : "s"}`);
        setCsvText("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FileSpreadsheet className="size-4 text-muted-foreground" />
          Manual CSV Import / Export
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          A temporary administrative tool for bulk-loading members while Ashbourne isn&apos;t connected — this is not a
          live sync. Data goes straight into this CRM&apos;s own database.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport} disabled={members.length === 0}>
            <Download className="size-3.5" />
            Export Members CSV
          </Button>
        </div>

        {canManage && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-medium text-foreground">Import Members CSV</p>
            <p className="text-xs text-muted-foreground">
              Paste CSV text with a header row: <code className="rounded bg-secondary px-1 py-0.5">{SAMPLE_HEADER}</code>.
              Only <code className="rounded bg-secondary px-1 py-0.5">fullName</code> is required;{" "}
              <code className="rounded bg-secondary px-1 py-0.5">planName</code> must match an existing plan name to
              create a membership.
            </p>
            <Textarea
              rows={6}
              placeholder={`${SAMPLE_HEADER}\nJane Smith,jane@example.com,07700900000,2024-01-15,Full Member,35,MONTHLY`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={handleImport} disabled={!csvText.trim() || pending}>
                <Upload className="size-3.5" />
                {pending ? "Importing…" : "Import"}
              </Button>
            </div>
            {result && (
              <div className="rounded-lg border border-border bg-secondary/20 p-3 text-xs">
                <p>
                  Created {result.created} member{result.created === 1 ? "" : "s"}, {result.membershipsCreated} membership
                  {result.membershipsCreated === 1 ? "" : "s"}
                  {result.skipped > 0 ? `, skipped ${result.skipped} row${result.skipped === 1 ? "" : "s"}` : ""}.
                </p>
                {result.errors.length > 0 && (
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-muted-foreground">
                    {result.errors.slice(0, 8).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
