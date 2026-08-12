import { getValidAccessToken } from "@/lib/microsoft-auth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(path: string, init?: RequestInit) {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Microsoft 365 isn't connected. Connect it in Settings first.");

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Microsoft Graph request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res;
}

export type GraphMessage = {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } } | null;
  receivedDateTime: string;
  bodyPreview: string;
  webLink: string;
  isRead: boolean;
};

export async function listRecentMessages(top = 8): Promise<GraphMessage[]> {
  const res = await graphFetch(
    `/me/messages?$top=${top}&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,bodyPreview,webLink,isRead`
  );
  const data = await res.json();
  return data.value ?? [];
}

export type GraphEvent = {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  location: { displayName: string } | null;
  webLink: string;
};

/** Outlook calendar events within [start, end] (ISO strings), for the Calendar page. */
export async function listCalendarEvents(start: string, end: string): Promise<GraphEvent[]> {
  const res = await graphFetch(
    `/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}` +
      `&$select=subject,start,end,isAllDay,location,webLink&$orderby=start/dateTime&$top=100`,
    { headers: { Prefer: 'outlook.timezone="UTC"' } }
  );
  const data = await res.json();
  return data.value ?? [];
}

const MAX_SIMPLE_UPLOAD_BYTES = 4 * 1024 * 1024; // Graph's simple-upload endpoint caps at 4MB.

function sanitizeSegment(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 120) || "Untitled";
}

export async function uploadClientDocument(
  clientName: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
) {
  if (fileBuffer.byteLength > MAX_SIMPLE_UPLOAD_BYTES) {
    throw new Error("File is larger than 4MB — please upload a smaller file for now.");
  }

  const folder = sanitizeSegment(clientName);
  const file = sanitizeSegment(fileName);
  const path = `/me/drive/root:/PRMOTE/${encodeURIComponent(folder)}/${encodeURIComponent(file)}:/content`;

  const res = await graphFetch(path, {
    method: "PUT",
    headers: { "Content-Type": mimeType || "application/octet-stream" },
    body: new Uint8Array(fileBuffer),
  });

  const item = await res.json();
  return {
    driveItemId: item.id as string,
    webUrl: item.webUrl as string,
    size: item.size as number,
  };
}

export async function getMicrosoftProfile() {
  const res = await graphFetch("/me?$select=displayName,mail,userPrincipalName");
  return res.json();
}
