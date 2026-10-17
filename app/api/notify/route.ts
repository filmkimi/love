import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const { data: member, error: memberError } = await supabase
    .from("couple_members")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (memberError) return NextResponse.json({ error: "Could not verify couple membership." }, { status: 500 });
  if (!member) return NextResponse.json({ error: "Not a member of this couple." }, { status: 403 });

  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineUserId = process.env.LINE_USER_ID;
  if (!lineToken || !lineUserId) {
    return NextResponse.json({ error: "LINE notifications are not configured." }, { status: 503 });
  }

  const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lineToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: "คิดถึงนะ ❤️ Someone is thinking of you." }]
    }),
    cache: "no-store"
  });
  if (!lineResponse.ok) {
    const details = await lineResponse.text();
    console.error("LINE notification failed:", lineResponse.status, details);
    return NextResponse.json({ error: "The notification provider rejected the request." }, { status: 502 });
  }
  return NextResponse.json({ sent: true });
}
