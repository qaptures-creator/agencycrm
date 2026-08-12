"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Upload, Trash2, ExternalLink, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { DotBadge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { DOCUMENT_CATEGORIES, labelFor, colorFor } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { uploadDocument, deleteDocument } from "@/actions/documents";
import type { Client, Document } from "@prisma/client";

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({
  client,
  documents,
  microsoftConnected,
  autoOpenUpload,
}: {
  client: Client;
  documents: Document[];
  microsoftConnected: boolean;
  autoOpenUpload?: boolean;
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = React.useState(Boolean(autoOpenUpload && microsoftConnected));
  const [category, setCategory] = React.useState(autoOpenUpload ? "PROPOSAL" : "OTHER");
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Document | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("clientId", client.id);
      formData.append("category", category);
      formData.append("file", file);
      await uploadDocument(formData);
      toast.success("Document uploaded to OneDrive");
      setUploadOpen(false);
      setFile(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteDocument(deleteTarget.id);
    toast.success("Document removed");
    setDeleteTarget(null);
    router.refresh();
  }

  if (!microsoftConnected) {
    return (
      <EmptyState
        icon={CloudOff}
        title="Microsoft 365 isn't connected"
        description="Connect your hello@prmote.co.uk account in Settings to upload proposals and documents to OneDrive."
        action={
          <Button size="sm" variant="outline" asChild>
            <a href="/settings">Go to Settings</a>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {documents.length} document{documents.length === 1 ? "" : "s"} · stored in OneDrive
        </p>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload /> Upload proposal
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" description="Upload a proposal, contract, or other file — it's stored in this client's OneDrive folder." />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="flex items-center gap-3 p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(doc.uploadedAt)} {doc.size ? `· ${formatBytes(doc.size)}` : ""}
                </p>
              </div>
              <DotBadge color={colorFor(DOCUMENT_CATEGORIES, doc.category)}>
                {labelFor(DOCUMENT_CATEGORIES, doc.category)}
              </DotBadge>
              <a href={doc.webUrl} target="_blank" rel="noreferrer">
                <Button size="icon" variant="ghost">
                  <ExternalLink className="size-3.5" />
                </Button>
              </a>
              <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(doc)}>
                <Trash2 className="size-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <EntityDialog open={uploadOpen} onOpenChange={setUploadOpen} title="Upload document">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file">File</Label>
            <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">Up to 4MB. Stored in OneDrive under &ldquo;PRMOTE / {client.companyName}&rdquo;.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </EntityDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the CRM&rsquo;s document list. The file itself stays in OneDrive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:opacity-90" onClick={handleDelete}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
