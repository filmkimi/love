import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPushAdminClient, sendPushToMember } from "@/lib/pushServer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนส่งการแจ้งเตือน" }, { status: 401 });
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
    const { data: members, error } = await admin
      .from("couple_members")
      .select("user_id");
    if (error) throw new Error(`Could not load couple members: ${error.message}`);
    if (!members.some((member) => member.user_id === auth.user.id) || members.length !== 2) {
      return NextResponse.json({ error: "ไม่พบสมาชิกของคู่รักที่ได้รับอนุญาต" }, { status: 403 });
    }

    const recipient = members.find((member) => member.user_id !== auth.user.id);
    if (!recipient) return NextResponse.json({ error: "ไม่พบโปรไฟล์คนรัก" }, { status: 404 });
    const result = await sendPushToMember(recipient.user_id, "คิดถึงนะ 💌", "คนรักของคุณส่งความคิดถึงมาให้แล้ว");
    if (result.failed) {
      return NextResponse.json({ error: "ส่งการแจ้งเตือนบางอุปกรณ์ไม่สำเร็จ" }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Could not send poke Web Push:", error);
    return NextResponse.json({ error: "ส่งการแจ้งเตือนไม่สำเร็จ" }, { status: 500 });
  }
}
