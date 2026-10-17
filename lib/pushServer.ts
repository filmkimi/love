import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

type StoredSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

let vapidConfigured = false;

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const configuredSubject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !configuredSubject) {
    throw new Error("Web Push VAPID settings are missing.");
  }
  const subject = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredSubject)
    ? `mailto:${configuredSubject}`
    : configuredSubject;
  if (!subject.startsWith("mailto:") && !/^https:\/\//i.test(subject)) {
    throw new Error("VAPID_SUBJECT must be an email address, mailto URI, or HTTPS URL.");
  }
  if (!vapidConfigured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase server settings are missing.");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function sendPushToMember(userId: string, title: string, body: string, url = "/", force = false) {
  configureWebPush();
  const supabase = createAdminClient();
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, subscription")
    .eq("user_id", userId);
  if (error) throw new Error(`Could not load push subscriptions: ${error.message}`);

  const results = await Promise.allSettled(
    subscriptions.map(async (record) => {
      const subscription = record.subscription as StoredSubscription;
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title, body, url, force }));
        return true;
      } catch (sendError) {
        const statusCode = (sendError as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", record.endpoint);
          if (deleteError) throw new Error(`Could not remove expired push subscription: ${deleteError.message}`);
          return false;
        }
        throw sendError;
      }
    })
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    console.error("One or more Web Push notifications failed:", failed);
  }
  const sent = results.filter((result) => result.status === "fulfilled" && result.value).length;
  return { sent, failed: failed.length };
}

export function createPushAdminClient() {
  return createAdminClient();
}
