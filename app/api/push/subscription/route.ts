import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPushAdminClient } from "@/lib/pushServer";

export const runtime = "nodejs";

async function getMemberId(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  const admin = createPushAdminClient();
  const { data: member, error: memberError } = await admin
    .from("couple_members")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (memberError) throw new Error(`Could not verify couple membership: ${memberError.message}`);
  return member ? data.user.id : null;
}

export async function POST(request: Request) {
  try {
    const userId = await getMemberId(request);
    if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบด้วยโปรไฟล์ของเรา" }, { status: 401 });

    const body = await request.json() as {
      endpoint?: unknown;
      keys?: { p256dh?: unknown; auth?: unknown };
    };
    if (
      typeof body.endpoint !== "string"
      || typeof body.keys?.p256dh !== "string"
      || typeof body.keys.auth !== "string"
    ) {
      return NextResponse.json({ error: "ข้อมูลอุปกรณ์สำหรับรับการแจ้งเตือนไม่ถูกต้อง" }, { status: 400 });
    }
    let endpoint: URL;
    try {
      endpoint = new URL(body.endpoint);
    } catch {
      return NextResponse.json({ error: "ที่อยู่บริการแจ้งเตือนไม่ถูกต้อง" }, { status: 400 });
    }
    if (endpoint.protocol !== "https:") {
      return NextResponse.json({ error: "ที่อยู่บริการแจ้งเตือนไม่ปลอดภัย" }, { status: 400 });
    }

    const { error } = await createPushAdminClient()
      .from("push_subscriptions")
      .upsert({
        user_id: userId,
        endpoint: body.endpoint,
        subscription: body
      }, { onConflict: "endpoint" });
    if (error) throw new Error(`Could not save push subscription: ${error.message}`);
    return NextResponse.json({ enabled: true });
  } catch (error) {
    console.error("Could not enable Web Push:", error);
    return NextResponse.json({ error: "เปิดใช้การแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getMemberId(request);
    if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบด้วยโปรไฟล์ของเรา" }, { status: 401 });
    const body = await request.json() as { endpoint?: unknown };
    if (typeof body.endpoint !== "string") {
      return NextResponse.json({ error: "ไม่พบอุปกรณ์ที่ต้องการปิดการแจ้งเตือน" }, { status: 400 });
    }

    const { error } = await createPushAdminClient()
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", body.endpoint);
    if (error) throw new Error(`Could not remove push subscription: ${error.message}`);
    return NextResponse.json({ enabled: false });
  } catch (error) {
    console.error("Could not disable Web Push:", error);
    return NextResponse.json({ error: "ปิดการแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
