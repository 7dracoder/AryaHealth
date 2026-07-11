import { validateRequest } from "twilio/lib/webhooks/webhooks.js";
import { getEnv, envFlag } from "./runtime-env";
import { publicRequestUrl } from "./http";

type TwilioSendResult =
  | { configured: false }
  | { configured: true; sid: string; status: string };

export async function sendSms(to: string, body: string): Promise<TwilioSendResult> {
  const accountSid = getEnv("TWILIO_ACCOUNT_SID");
  const apiKey = getEnv("TWILIO_API_KEY");
  const apiSecret = getEnv("TWILIO_API_SECRET");
  const authToken = getEnv("TWILIO_AUTH_TOKEN");
  const from = getEnv("TWILIO_PHONE_NUMBER");
  const messagingServiceSid = getEnv("TWILIO_MESSAGING_SERVICE_SID");
  const username = apiKey ?? accountSid;
  const password = apiSecret ?? authToken;

  if (!accountSid || !username || !password || (!from && !messagingServiceSid)) {
    return { configured: false };
  }

  const form = new URLSearchParams({ To: to, Body: body });
  if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid);
  else if (from) form.set("From", from);

  const baseUrl = getEnv("APP_BASE_URL");
  if (baseUrl?.startsWith("https://")) {
    form.set("StatusCallback", `${baseUrl.replace(/\/$/, "")}/api/webhooks/twilio/status`);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${username}:${password}`)}`,
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: form,
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    code?: number;
  };
  if (!response.ok || !payload.sid) {
    throw new Error(`SMS delivery request failed${payload.code ? ` (${payload.code})` : ""}`);
  }
  return { configured: true, sid: payload.sid, status: payload.status ?? "queued" };
}

export async function sendAppointmentReceipt(
  phone: string,
  appointmentId: string,
  issueKind: "new" | "continuation",
): Promise<TwilioSendResult> {
  const kindLabel = issueKind === "continuation" ? "follow-up concern" : "new concern";
  return sendSms(
    phone,
    `Arya Health received request ${appointmentId} (${kindLabel}). Voice disease screening did not run—no disease was inferred from your voice. Not a confirmed booking. Reply STOP to opt out.`,
  );
}

export async function sendConversationFollowUp(
  phone: string,
  issueKind: "new" | "continuation",
): Promise<TwilioSendResult> {
  const kindLabel = issueKind === "continuation" ? "a continuation of a prior concern" : "a new concern";
  return sendSms(
    phone,
    `Arya Health: Thanks for talking with Voia. We recorded this as ${kindLabel}. Voice disease screening did not run—no disease was inferred from your voice. Reply STOP to opt out.`,
  );
}

export function validateTwilioWebhook(
  request: Request,
  params: Record<string, string>,
): { valid: boolean; configured: boolean } {
  const enforce = envFlag("TWILIO_VALIDATE_SIGNATURES", true);
  if (!enforce && getEnv("PRODUCT_MODE") !== "live") {
    return { valid: true, configured: false };
  }

  const authToken = getEnv("TWILIO_AUTH_TOKEN");
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!authToken || !signature) return { valid: false, configured: Boolean(authToken) };

  const configuredBase = getEnv("APP_BASE_URL")?.replace(/\/$/, "");
  const requestUrl = new URL(request.url);
  const validationUrl = configuredBase
    ? `${configuredBase}${requestUrl.pathname}${requestUrl.search}`
    : publicRequestUrl(request);

  return {
    valid: validateRequest(authToken, signature, validationUrl, params),
    configured: true,
  };
}
