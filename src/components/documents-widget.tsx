import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { DOCUMENT_CATEGORIES, labelFor } from "@/lib/constants";
import { formatRelativeToNow } from "@/lib/utils";
import type { Document, Client } from "@prisma/client";

export function DocumentsWidget({
  documents,
  microsoftConnected,
}: {
  documents: (Document & { client: Client })[];
  microsoftConnected: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold text-foreground">Documents</CardTitle>
        {microsoftConnected && documents.length > 0 && (
          <span className="text-xs text-muted-foreground">OneDrive</span>
        )}
      </CardHeader>
      <CardContent>
        {!microsoftConnected ? (
          <EmptyState
            icon={FileText}
            title="Not connected"
            description="Connect Microsoft 365 in Settings to store and see client proposals and documents here."
            className="border-none bg-transparent py-8"
          />
        ) : documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Uploads from client profiles will show up here." className="border-none bg-transparent py-8" />
        ) : (
          <ul className="space-y-1">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/60">
                <Link href={`/clients/${doc.clientId}?tab=documents`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {doc.client.companyName} · {labelFor(DOCUMENT_CATEGORIES, doc.category)} · {formatRelativeToNow(doc.uploadedAt)}
                  </p>
                </Link>
                <a href={doc.webUrl} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
