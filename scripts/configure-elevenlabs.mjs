import { readFile } from "node:fs/promises";

const apply = process.argv.includes("--apply");
const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.ELEVENLABS_API_KEY;
const agentId = process.env.ELEVENLABS_AGENT_ID || "agent_5501kx8wda1pendvh6xvme7fxn78";
const toolSecret = process.env.VOIA_TOOL_SECRET;
let secretId = process.env.ELEVENLABS_TOOL_SECRET_ID;

const missing = [
  ["APP_BASE_URL", baseUrl],
  ["ELEVENLABS_API_KEY", apiKey],
  ["VOIA_TOOL_SECRET", toolSecret],
].filter(([, value]) => !value).map(([name]) => name);

if (!apply) {
  console.log("Dry run only. No ElevenLabs resources changed.");
  console.log(`Agent: ${agentId}`);
  console.log(`App: ${baseUrl || "<missing APP_BASE_URL>"}`);
  console.log("Planned tools: search_providers, request_appointment, search_medical_sources");
  console.log(`Missing: ${missing.length ? missing.join(", ") : "none"}`);
  console.log("Run npm run setup:agent -- --apply after review.");
  process.exit(0);
}

if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
if (!baseUrl.startsWith("https://")) throw new Error("APP_BASE_URL must be a public HTTPS URL");

async function api(path, options = {}) {
  const response = await fetch(`https://api.elevenlabs.io/v1${path}`, {
    ...options,
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      ...options.headers,
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = payload.detail || payload.message || payload.error;
    throw new Error(
      `ElevenLabs ${path} failed (${response.status})${detail ? `: ${JSON.stringify(detail)}` : ""}`,
    );
  }
  return payload;
}

if (!secretId) {
  const created = await api("/convai/secrets", {
    method: "POST",
    body: JSON.stringify({ type: "new", name: "VOIA_TOOL_BEARER", value: `Bearer ${toolSecret}` }),
  });
  secretId = created.secret_id;
  if (!secretId) throw new Error("ElevenLabs secret response did not include secret_id");
  console.log(`Created ElevenLabs tool secret: ${secretId}`);
  console.log("Save ELEVENLABS_TOOL_SECRET_ID to your secret manager before rerunning.");
}

function webhookTool({ name, description, path, required, properties, responseFilters }) {
  return {
    tool_config: {
      type: "webhook",
      name,
      description,
      response_timeout_secs: 20,
      interruption_mode: "disable_during_tool",
      pre_tool_speech: "auto",
      execution_mode: "immediate",
      api_schema: {
        url: `${baseUrl}${path}`,
        method: "POST",
        content_type: "application/json",
        request_headers: {
          Authorization: { secret_id: secretId },
        },
        request_body_schema: { type: "object", required, properties },
        response_filter: {
          mode: "allow",
          filters: responseFilters,
          content_type: "application/json",
        },
      },
    },
  };
}

const specialty = {
  type: "string",
  description: "Clinician specialty needed.",
  enum: ["Primary care", "Neurology", "Pulmonology", "Cardiology", "Mental health", "Speech-language pathology", "Ear, nose and throat"],
};

const tools = [
  webhookTool({
    name: "search_providers",
    description: "Find a small set of public doctor or clinic listings by specialty and coarse location. Does not check appointment availability.",
    path: "/api/tools/providers/search",
    required: ["location", "specialty"],
    properties: {
      location: { type: "string", description: "City and state only. Never include patient identity or symptoms." },
      specialty,
    },
    responseFilters: ["providers", "searchedAt", "source", "availability", "instruction"],
  }),
  webhookTool({
    name: "request_appointment",
    description: "Save a pending provider-contact request after explicit patient confirmation and care-data consent. This does not book a confirmed slot.",
    path: "/api/tools/appointments/request",
    required: ["fullName", "phone", "location", "specialty", "reason", "reasonCategory", "modality", "requestedDate", "timeWindow", "timezone", "consent"],
    properties: {
      fullName: { type: "string", description: "Patient's confirmed full name." },
      phone: { type: "string", description: "Confirmed E.164 phone, such as +12125551234." },
      email: { type: "string", description: "Optional confirmed email." },
      location: { type: "string", description: "Patient city and state." },
      specialty,
      reason: { type: "string", description: "Brief patient-stated visit reason used for emergency gate; not stored as free text." },
      reasonCategory: { type: "string", description: "Short non-diagnostic reason category." },
      modality: { type: "string", description: "Requested visit format.", enum: ["in_person", "telehealth", "either"] },
      requestedDate: { type: "string", description: "Preferred date in YYYY-MM-DD format." },
      timeWindow: { type: "string", description: "Patient's preferred time window.", enum: ["morning", "afternoon", "evening", "anytime"] },
      timezone: { type: "string", description: "IANA timezone, such as America/New_York." },
      provider: {
        type: "object",
        description: "Optional selected public provider listing.",
        properties: {
          id: { type: "string", description: "Provider listing identifier." },
          name: { type: "string", description: "Provider or clinic name." },
          facilityName: { type: "string", description: "Facility category or name." },
          address: { type: "string", description: "Public provider address." },
          phone: { type: "string", description: "Public provider phone number." },
          website: { type: "string", description: "Public provider website URL." },
          categories: { type: "array", description: "Public provider categories.", items: { type: "string", description: "One provider category." } },
        },
      },
      consent: {
        type: "object",
        required: ["careData", "screening", "sms"],
        properties: {
          careData: { type: "boolean", description: "Must be true only after explicit care-data consent." },
          screening: { type: "boolean", description: "Separate optional screening consent. Screening remains disabled." },
          sms: { type: "boolean", description: "True only after separate SMS consent." },
        },
      },
    },
    responseFilters: ["appointment"],
  }),
  webhookTool({
    name: "search_medical_sources",
    description: "Find general educational sources from CDC, NIH, MedlinePlus, and WHO. Never use for diagnosis or treatment planning.",
    path: "/api/tools/medical-info",
    required: ["query"],
    properties: { query: { type: "string", description: "General, non-identifying medical education query." } },
    responseFilters: ["sources", "instruction"],
  }),
];

let existingTools = [];
try {
  const listed = await api("/convai/tools");
  existingTools = listed.tools || listed.items || [];
} catch {
  existingTools = [];
}

const toolIds = [];
for (const tool of tools) {
  const name = tool.tool_config.name;
  const existing = existingTools.find((item) => item?.tool_config?.name === name || item?.name === name);
  const existingId = existing?.id || existing?.tool_id;
  const result = existingId
    ? await api(`/convai/tools/${existingId}`, { method: "PATCH", body: JSON.stringify(tool) })
    : await api("/convai/tools", { method: "POST", body: JSON.stringify(tool) });
  const id = result.id || result.tool_id || existingId;
  if (!id) throw new Error(`No tool id returned for ${name}`);
  toolIds.push(id);
  console.log(`${existingId ? "Updated" : "Created"} ${name}: ${id}`);
}

const currentAgent = await api(`/convai/agents/${agentId}`);
const existingIds = currentAgent?.conversation_config?.agent?.prompt?.tool_ids || [];
const prompt = await readFile(new URL("../config/voia-agent-prompt.md", import.meta.url), "utf8");
await api(`/convai/agents/${agentId}`, {
  method: "PATCH",
  body: JSON.stringify({
    conversation_config: {
      agent: {
        prompt: {
          prompt,
          tool_ids: [...new Set([...existingIds, ...toolIds])],
        },
        first_message: "Hi, I'm Voia from Arya Health. I can help you find care and request an appointment. If this is an emergency, please call your local emergency number now. What language would you prefer?",
      },
    },
  }),
});

console.log(`Configured agent ${agentId} with ${toolIds.length} Voia webhook tools.`);
