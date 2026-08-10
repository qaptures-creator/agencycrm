import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Contract for connecting a real mailbox (Microsoft 365/Outlook, Google
 * Workspace/Gmail, or IMAP) to the Enquiries inbox. Incoming mail should
 * create/update GymEnquiry + GymEnquiryMessage records; outbound replies
 * should be sent through the same connected account.
 *
 * No provider is implemented yet — admin@musclemassacre.com is not wired up.
 * When credentials/API access become available, implement this interface
 * (e.g. MicrosoftGraphEmailProvider, GmailEmailProvider, ImapEmailProvider)
 * and swap it in via getEmailProvider() below. Nothing in the UI should ever
 * fabricate a connection — see Settings → Integrations → Email.
 */
export interface EmailProvider {
  getMessages(params: { folder?: string; since?: Date }): Promise<EmailMessage[]>;
  getThread(threadId: string): Promise<EmailMessage[]>;
  sendMessage(params: { to: string; subject: string; body: string; inReplyTo?: string }): Promise<void>;
  markRead(messageId: string): Promise<void>;
}

export type EmailMessage = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: Date;
  read: boolean;
};

export async function isEmailIntegrationConnected(): Promise<boolean> {
  const integration = await prisma.gymIntegration.findUnique({ where: { provider: "EMAIL" } });
  return integration?.status === "CONNECTED";
}

/** Returns null until a real provider is connected — callers must handle the
 * "Not Connected" state rather than assuming a provider always exists. */
export async function getEmailProvider(): Promise<EmailProvider | null> {
  const connected = await isEmailIntegrationConnected();
  if (!connected) return null;
  throw new Error("No EmailProvider implementation is registered yet.");
}
