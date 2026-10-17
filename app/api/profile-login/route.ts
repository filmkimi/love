import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ProfileId = "A" | "B";
type ProfileConfig = { email: string; password: string; pinHash: string };

function isPlaceholder(value: string | undefined): boolean {
  return !value
    || /^(your[-_ ]|replace[-_ ]|example|changeme|placeholder)/i.test(value.trim())
    || /@example\.(com|org|net)$/i.test(value.trim());
}

function isValidSupabaseUrl(value: string | undefined): boolean {
  if (!value || isPlaceholder(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function isValidPublicKey(value: string | undefined): boolean {
  if (!value || isPlaceholder(value)) return false;
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
    || /^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value);
}

function isValidServiceKey(value: string | undefined): boolean {
  if (!value || isPlaceholder(value)) return false;
  if (/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(value)) return true;
  const parts = value.split(".");
  if (parts.length !== 3 || !parts[1]) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function profileMissingSettings(profile: ProfileId): string[] {
  const prefix = `USER_${profile}`;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  const pinHash = process.env[`${prefix}_PIN_HASH`];
  const missing: string[] = [];
  if (!email || isPlaceholder(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push(`${prefix}_EMAIL`);
  if (isPlaceholder(password)) missing.push(`${prefix}_PASSWORD`);
  if (!pinHash || !/^[0-9a-f]{32}:[0-9a-f]{64}$/i.test(pinHash)) missing.push(`${prefix}_PIN_HASH`);
  return missing;
}

function getProfileConfig(profile: ProfileId): ProfileConfig | null {
  const values = {
    A: {
      email: process.env.USER_A_EMAIL,
      password: process.env.USER_A_PASSWORD,
      pinHash: process.env.USER_A_PIN_HASH
    },
    B: {
      email: process.env.USER_B_EMAIL,
      password: process.env.USER_B_PASSWORD,
      pinHash: process.env.USER_B_PIN_HASH
    }
  }[profile];
  if (
    !values.email ||
    isPlaceholder(values.email) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) ||
    !values.password ||
    isPlaceholder(values.password) ||
    !values.pinHash ||
    !/^[0-9a-f]{32}:[0-9a-f]{64}$/i.test(values.pinHash)
  ) return null;
  return { email: values.email, password: values.password, pinHash: values.pinHash };
}

function verifyPin(pin: string, encodedHash: string): boolean {
  const [salt, expectedHex, extra] = encodedHash.split(":");
  if (!salt || !expectedHex || extra !== undefined || !/^[0-9a-f]{64}$/i.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(pin, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

function getAttemptKey(request: Request, profile: ProfileId): string | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  const forwardedFor = request.headers.get("x-forwarded-for");
  const remoteAddress =
    request.headers.get("x-vercel-forwarded-for")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    forwardedFor?.split(",").at(-1)?.trim() ||
    "unknown";
  return createHmac("sha256", secret).update(`${remoteAddress}:${profile}`).digest("hex");
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let body: { profile?: unknown; pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 });
  }
  if ((body.profile !== "A" && body.profile !== "B") || typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin)) {
    return NextResponse.json({ error: "Choose a profile and enter its six-digit PIN." }, { status: 400 });
  }

  const profile = body.profile as ProfileId;
  const missingSettings: string[] = [];
  if (!isValidSupabaseUrl(url)) missingSettings.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!isValidPublicKey(anonKey)) missingSettings.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!isValidServiceKey(serviceRoleKey)) missingSettings.push("SUPABASE_SERVICE_ROLE_KEY");
  missingSettings.push(...profileMissingSettings("A"), ...profileMissingSettings("B"));
  if (missingSettings.length) {
    return NextResponse.json({
      error: "Supabase sign-in setup is incomplete. Add valid values for the listed server settings, then restart the app.",
      missingSettings
    }, { status: 503 });
  }
  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json({
      error: "Supabase sign-in setup is incomplete. Check the server settings, then restart the app."
    }, { status: 503 });
  }

  const config = getProfileConfig(profile);
  const attemptKey = getAttemptKey(request, profile);
  if (!config || !attemptKey) {
    return NextResponse.json({
      error: "Supabase sign-in setup is incomplete. Check the selected profile’s server settings, then restart the app."
    }, { status: 503 });
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: allowed, error: limitError } = await adminClient.rpc("consume_pin_attempt", {
    p_attempt_key: attemptKey,
    p_max_attempts: 5,
    p_window_seconds: 900
  });
  if (limitError) {
    console.error("PIN attempt limiter failed:", limitError.message);
    const limiterMessage = limitError.code === "42702"
      ? "The Supabase PIN limiter has an outdated SQL function. Run the updated supabase/schema.sql in the same project shown by your URL."
      : limitError.code === "PGRST202" || limitError.code === "42883"
        ? "The Supabase PIN limiter function is missing or out of date. Run supabase/schema.sql in the same project shown by your URL."
        : limitError.code === "42501"
          ? "The Supabase service key cannot run the PIN limiter. Set the project's server-only service_role/secret key in .env.local, then restart the app."
          : "Could not reach the Supabase PIN limiter. Check the project URL/key and run supabase/schema.sql in that project.";
    return NextResponse.json({
      error: limiterMessage
    }, { status: 503 });
  }
  if (allowed !== true) {
    return NextResponse.json({ error: "Too many tries. Please wait 15 minutes and try again." }, {
      status: 429,
      headers: { "Retry-After": "900" }
    });
  }

  if (!verifyPin(body.pin, config.pinHash)) {
    return NextResponse.json({ error: "That PIN didn’t work. Try again." }, { status: 401 });
  }

  const { error: clearLimitError } = await adminClient.rpc("clear_pin_attempts", { attempt_key: attemptKey });
  if (clearLimitError) {
    console.error("Could not clear successful PIN attempt limit:", clearLimitError.message);
    return NextResponse.json({ error: "Supabase sign-in is temporarily unavailable. Please try again." }, { status: 503 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: config.email,
    password: config.password
  });
  if (error || !data.session) {
    console.error("Configured profile could not sign in to Supabase:", error?.message);
    return NextResponse.json({ error: "This profile could not be signed in. Check its server credentials." }, { status: 503 });
  }
  const { data: member, error: memberError } = await adminClient
    .from("couple_members")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (memberError || !member) {
    console.error("PIN profile is not enrolled as a couple member:", memberError?.message || "No matching member.");
    return NextResponse.json({ error: "This profile is not enabled for the private couple space." }, { status: 403 });
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  }, {
    headers: { "Cache-Control": "no-store, private" }
  });
}
