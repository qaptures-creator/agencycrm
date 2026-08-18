"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { importAshbourneSalesReportAction } from "@/actions/gym/import";

export function ImportSalesReportDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<Awaited<ReturnType<typeof importAshbourneSalesReportAction>> | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setImporting(true);
    setResult(null);
    try {
      const text = await file.text();
      const summary = await importAshbourneSalesReportAction(text);
      setResult(summary);
      toast.success(`Imported: ${summary.membersCreated} new members, ${summary.paymentsCreated} payments recorded`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Import Sales Report
      </Button>

      <EntityDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setResult(null);
        }}
        title="Import Ashbourne Sales Report"
        description="Upload a Combined Sales Report CSV export. New members, memberships and payments are added — existing records are never overwritten. Safe to re-run the same file."
      >
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90"
          />

          {importing && <p className="text-sm text-muted-foreground">Importing… this can take a minute for large files.</p>}

          {result && (
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
              <p className="font-medium">Import complete</p>
              <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                <li>{result.totalRows} rows read</li>
                <li>{result.membersCreated} new members created</li>
                <li>{result.membershipsCreated} new memberships created</li>
                <li>{result.paymentsCreated} payments recorded</li>
                {result.paymentsSkippedExisting > 0 && <li>{result.paymentsSkippedExisting} payments already existed (skipped)</li>}
                {result.rowsSkipped > 0 && <li className="text-warning-foreground">{result.rowsSkipped} rows skipped (unparseable)</li>}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </EntityDialog>
    </>
  );
}
