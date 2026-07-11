import { createConversationSession } from "@/lib/elevenlabs";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "elevenlabs-session", 10, 60);
    const session = await createConversationSession();
    return Response.json(session, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return errorResponse(error, "Voice assistant is unavailable right now");
  }
}
