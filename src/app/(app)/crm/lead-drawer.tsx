"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ArrowRightCircle, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { LeadForm } from "./lead-form";
import { ActivityLog, type ActivityWithUser } from "@/components/activity-log";
import { ConvertLeadDialog } from "./convert-lead-dialog";
import { deleteLead } from "@/actions/leads";
import type { ServiceOption } from "@/components/services-select";
import type { Lead, PipelineStage, User, Service } from "@prisma/client";

type FullLead = Lead & {
  services: Service[];
  assignedTo: User | null;
  stage: PipelineStage;
  activities: ActivityWithUser[];
};

export function LeadDrawer({
  leadId,
  createStageId,
  open,
  onOpenChange,
  stages,
  users,
  services,
  currentUserId,
}: {
  leadId: string | null;
  createStageId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStage[];
  users: User[];
  services: ServiceOption[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [lead, setLead] = React.useState<FullLead | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [convertOpen, setConvertOpen] = React.useState(false);

  const refresh = React.useCallback(() => {
    if (!leadId) return;
    setLoading(true);
    fetch(`/api/leads/${leadId}`)
      .then((r) => r.json())
      .then((d) => setLead(d.lead))
      .finally(() => setLoading(false));
  }, [leadId]);

  React.useEffect(() => {
    if (open && leadId) refresh();
    if (!open) setLead(null);
  }, [open, leadId, refresh]);

  async function handleDelete() {
    if (!leadId) return;
    await deleteLead(leadId);
    toast.success("Lead deleted");
    setDeleteOpen(false);
    onOpenChange(false);
    router.refresh();
  }

  const isWon = lead?.stage.isWon;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{leadId ? lead?.companyName ?? "Lead" : "New lead"}</SheetTitle>
            <SheetDescription>
              {leadId ? "Edit lead details, and log calls, emails and follow-ups." : "Add a new lead to your pipeline."}
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            {leadId && loading && !lead ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : leadId && !lead ? null : (
              <>
                {isWon && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 p-3">
                    <p className="text-sm text-success-foreground">This lead is marked Won.</p>
                    <Button size="sm" variant="outline" onClick={() => setConvertOpen(true)}>
                      <ArrowRightCircle /> Convert to client
                    </Button>
                  </div>
                )}

                {leadId ? (
                  <Tabs defaultValue="details">
                    <TabsList>
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="activity">
                        Activity {lead && lead.activities.length > 0 && `(${lead.activities.length})`}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="details">
                      {lead && (
                        <LeadForm
                          lead={lead}
                          stages={stages}
                          users={users}
                          services={services}
                          onSuccess={() => {
                            router.refresh();
                            refresh();
                          }}
                        />
                      )}
                    </TabsContent>
                    <TabsContent value="activity">
                      {lead && (
                        <ActivityLog
                          activities={lead.activities}
                          leadId={lead.id}
                          currentUserId={currentUserId}
                          onChanged={() => {
                            router.refresh();
                            refresh();
                          }}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                ) : (
                  <LeadForm
                    stages={stages}
                    users={users}
                    services={services}
                    defaultStageId={createStageId}
                    onSuccess={() => {
                      router.refresh();
                      onOpenChange(false);
                    }}
                    onCancel={() => onOpenChange(false)}
                  />
                )}

                {leadId && (
                  <div className="mt-6 border-t border-border pt-4">
                    <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                      <Trash2 /> Delete lead
                    </Button>
                  </div>
                )}
              </>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {lead?.companyName} and its activity history. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:opacity-90" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConvertLeadDialog lead={lead} services={services} open={convertOpen} onOpenChange={setConvertOpen} />
    </>
  );
}
