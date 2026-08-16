"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DownloadPdfButton({
  proposalId,
  hasUnsavedChanges,
}: {
  proposalId: string;
  /** When true, confirm before downloading a PDF that won't reflect the latest edits. */
  hasUnsavedChanges?: boolean;
}) {
  const [loading, setLoading] = React.useState(false);

  async function handleDownload() {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Download the PDF anyway? It will only reflect the last saved version.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/pdf`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `PDF generation failed (${res.status})`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "proposal.pdf";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate the PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" onClick={handleDownload} disabled={loading}>
      {loading ? <Loader2 className="animate-spin" /> : <Download />}
      {loading ? "Generating PDF…" : "Download PDF"}
    </Button>
  );
}
