import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPushAdminClient, sendPushToMember } from "@/lib/pushServer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนทดสอบการแจ้งเตือน" }, { status: 401 });
  }

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user) {
      return NextResponse.json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
    }

    const admin = createPushAdminClient();
    const { data: member, error } = await admin
      .from("couple_members")
      .select("user_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error) throw new Error(`Could not verify couple membership: ${error.message}`);
    if (!member) return NextResponse.json({ error: "ไม่พบสมาชิกที่ได้รับอนุญาต" }, { status: 403 });

    const result = await sendPushToMember(
      auth.user.id,
      "ทดสอบการแจ้งเตือน",
      "หากเห็นข้อความนี้ แสดงว่ารับการแจ้งเตือนได้แล้ว 💌",
      "/",
      true
    );
    if (result.failed) {
      return NextResponse.json({
        ...result,
        error: "บริการแจ้งเตือนปฏิเสธคำขอ ตรวจสอบรหัส VAPID ใน Vercel และลงทะเบียนอุปกรณ์ใหม่"
      }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Could not send test Web Push:", error);
    const detail = error instanceof Error ? error.message : "";
    const missingSubscriptions = detail.includes("Web Push VAPID settings are missing")
      || detail.includes("Supabase server settings are missing");
    return NextResponse.json({
      error: missingSubscriptions
        ? "การตั้งค่าฝั่ง Vercel ยังไม่ครบ กรุณาตรวจสอบ VAPID และ Supabase server key"
        : "ทดสอบการแจ้งเตือนไม่สำเร็จ กรุณาตรวจสอบ Vercel logs",
      configurationError: missingSubscriptions
    }, { status: 500 });
  }
}
