import { registerTwilioCall } from "@/lib/elevenlabs";
import { escapeXml, xmlResponse } from "@/lib/http";
import { validateTwilioWebhook } from "@/lib/twilio";

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(
    Array.from(form.entries(), ([key, value]) => [key, typeof value === "string" ? value : value.name]),
  );
  if (!validateTwilioWebhook(request, params).valid) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const twiml = await registerTwilioCall({
      from: params.From ?? "",
      to: params.To ?? "",
      direction: params.Direction ?? "inbound",
    });
    return xmlResponse(twiml);
  } catch {
    return xmlResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(
        "Voia is temporarily unavailable. If this is an emergency, hang up and call your local emergency number now.",
      )}</Say></Response>`,
      200,
    );
  }
}
