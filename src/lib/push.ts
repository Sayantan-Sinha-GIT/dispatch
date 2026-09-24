import { createSign } from "node:crypto";

/**
 * Sends push notifications through Firebase Cloud Messaging (HTTP v1).
 * Server-side only: it holds the Firebase service account, which lives in
 * the FIREBASE_SERVICE_ACCOUNT environment variable as the JSON Google gave.
 */

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    console.error("[push] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

let cached: { token: string; expires: number } | null = null;

/** An OAuth token for FCM, from a JWT signed with the service account key; reused until near expiry. */
async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export type PushMessage = {
  title: string;
  body: string;
  /** Where tapping it should open, e.g. "/rider". */
  url: string;
  /** "offers" rings loud and pops up; "updates" is a normal notification. */
  channel: "offers" | "updates";
  tag?: string;
};

export type PushResult = { token: string; ok: boolean; gone: boolean; error?: string };

/** Sends one message to each token. `gone` marks tokens FCM says no longer exist. */
export async function sendPush(tokens: string[], msg: PushMessage): Promise<PushResult[]> {
  const sa = serviceAccount();
  if (!sa) return tokens.map((token) => ({ token, ok: false, gone: false, error: "not configured" }));
  const bearer = await accessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  return Promise.all(
    tokens.map(async (token): Promise<PushResult> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: msg.title, body: msg.body },
            data: { url: msg.url },
            android: {
              priority: "high",
              // A new offer outlives its usefulness in minutes.
              ttl: msg.channel === "offers" ? "300s" : "86400s",
              notification: {
                channel_id: msg.channel,
                icon: "ic_stat_dispatch",
                color: "#6B4EF0",
                tag: msg.tag,
                default_sound: true,
              },
            },
          },
        }),
      });
      if (res.ok) return { token, ok: true, gone: false };
      const text = await res.text();
      const gone = res.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(text);
      return { token, ok: false, gone, error: `${res.status} ${text.slice(0, 200)}` };
    }),
  );
}
