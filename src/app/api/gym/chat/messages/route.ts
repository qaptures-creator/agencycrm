import { NextRequest, NextResponse } from "next/server";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { getInitialChatMessages, getChatMessagesSince, getUnreadChatCount, postChatMessage, CHAT_MESSAGE_MAX_LENGTH } from "@/lib/gym/chat";

/** GET: ?since=<ISO timestamp> returns the delta for polling (or, with
 * &count=1, just a cheap count for the closed widget's unread badge); no
 * `since` returns the latest page for the widget's initial load. */
export async function GET(req: NextRequest) {
  const user = await getCurrentGymUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const since = req.nextUrl.searchParams.get("since");
  if (since && req.nextUrl.searchParams.get("count") === "1") {
    const count = await getUnreadChatCount(since);
    return NextResponse.json({ count });
  }

  const messages = since ? await getChatMessagesSince(since) : await getInitialChatMessages();
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentGymUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  if (text.length > CHAT_MESSAGE_MAX_LENGTH) {
    return NextResponse.json({ error: `Message is too long (max ${CHAT_MESSAGE_MAX_LENGTH} characters).` }, { status: 400 });
  }

  const message = await postChatMessage(user.id, text);
  return NextResponse.json({ message });
}
