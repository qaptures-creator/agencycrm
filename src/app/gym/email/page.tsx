import { requirePermission } from "@/lib/gym/auth";
import { getFolderCounts, getMessageList } from "@/lib/gym/email-data";
import { EmailClient } from "./email-client";
import type { WellKnownFolder } from "@/lib/email/types";

const VALID_FOLDERS: readonly WellKnownFolder[] = ["inbox", "sent", "drafts", "spam", "trash"];

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; message?: string; unread?: string }>;
}) {
  await requirePermission("viewEmail");
  const { folder: folderParam, message: messageId, unread } = await searchParams;
  const folder: WellKnownFolder = (VALID_FOLDERS as readonly string[]).includes(folderParam ?? "")
    ? (folderParam as WellKnownFolder)
    : "inbox";
  const unreadOnly = unread === "1";

  const [counts, { rows, hasMore }] = await Promise.all([getFolderCounts(), getMessageList(folder, { unreadOnly })]);

  return (
    <EmailClient
      folder={folder}
      counts={counts}
      initialRows={rows}
      initialHasMore={hasMore}
      initialUnreadOnly={unreadOnly}
      selectedMessageId={messageId ?? null}
    />
  );
}
