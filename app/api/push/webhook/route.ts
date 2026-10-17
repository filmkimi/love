import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createPushAdminClient, sendPushToMember } from "@/lib/pushServer";

export const runtime = "nodejs";

type MessageWebhook = {
  type?: string;
  table?: string;
  record?: { sender_id?: string; text?: string | null; image_url?: string | null };
};

function hasValidSecret(request: Request) {
  const expected = process.env.PUSH_WEBHOOK_SECRET;
  const received = request.headers.get("x-push-webhook-secret") || "";
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  try {
    const event = await request.json() as MessageWebhook;
    const senderId = event.record?.sender_id;
    if (event.type !== "INSERT" || event.table !== "messages" || !senderId) {
      return NextResponse.json({ ignored: true });
    }

    const admin = createPushAdminClient();
    const { data: members, error } = await admin
      .from("couple_members")
      .select("user_id, display_name");
    if (error) throw new Error(`Could not load couple members: ${error.message}`);
    const sender = members.find((member) => member.user_id === senderId);
    if (!sender || members.length !== 2) {
      return NextResponse.json({ ignored: true });
    }

    const recipient = members.find((member) => member.user_id !== senderId);
    if (!recipient) return NextResponse.json({ ignored: true });
    const body = event.record?.image_url && !event.record.text
      ? `${sender.display_name} ส่งรูปภาพมาให้คุณ 💌`
      : `${sender.display_name} ส่งข้อความใหม่ถึงคุณ 💌`;
    const result = await sendPushToMember(recipient.user_id, "ข้อความใหม่", body);
    if (result.failed) {
      return NextResponse.json({ error: "One or more Web Push deliveries failed." }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Could not send message Web Push:", error);
    return NextResponse.json({ error: "Web Push delivery failed." }, { status: 500 });
  }
}
