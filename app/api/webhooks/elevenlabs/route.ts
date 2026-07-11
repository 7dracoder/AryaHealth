import { recordWebhookReceipt } from "@/db/repository";
import { sha256 } from "@/lib/crypto";
import { ELEVENLABS_AGENT_ID } from "@/lib/runtime-env";
import { verifyElevenLabsWebhook } from "@/lib/elevenlabs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("elevenlabs-signature") ?? "";

  try {
    const event = await verifyElevenLabsWebhook(rawBody, signature);
    const data = event.data ?? {};
    if (data.agent_id && data.agent_id !== ELEVENLABS_AGENT_ID) {
      return new Response("Forbidden", { status: 403 });
    }

    const externalId = data.conversation_id ?? `${event.event_timestamp ?? 0}`;
    await recordWebhookReceipt({
      provider: "elevenlabs",
      externalId,
      payloadHash: await sha256(rawBody),
      status: event.type ?? "unknown",
    });

    // Deliberately do not persist transcript, audio, or free-text analysis.
    return Response.json({ status: "received" });
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
}
