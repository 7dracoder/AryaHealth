# Voia by Arya Health

End-to-end healthcare care-navigation preview: ElevenLabs web voice/chat, Twilio phone/SMS, Nimble provider discovery, appointment-request workflow, D1 persistence, consent records, emergency gating, and signed webhooks.

## Important product boundary

This build saves **pending appointment requests**. It does not claim a provider slot is available or confirmed. A real scheduling/FHIR/EHR adapter is still required before status may become `confirmed`.

Voice disease screening is deliberately disabled. No validated screening model/API was supplied, so Voia never infers disease from a patient's voice or wording.

Do not process real protected health information until all vendors and deployment systems are covered by the required agreements and controls. ElevenLabs requires Enterprise BAA + Zero Retention for PHI; Twilio requires a BAA/HIPAA project configuration.

## Run locally

Requirements: Node.js 22.13+.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Open `http://localhost:3000`. Check integration state at `http://localhost:3000/api/health`.

Real values belong in `.dev.vars` locally and the hosting secret manager in production. Never commit them.

## Required live configuration

See `.env.example` for every variable. Minimum external setup:

- `ELEVENLABS_API_KEY` for private WebRTC tokens and agent configuration.
- `ELEVENLABS_WEBHOOK_SECRET` for signed post-call events.
- `VOIA_TOOL_SECRET` plus `ELEVENLABS_TOOL_SECRET_ID` for authenticated agent tools.
- `NIMBLE_API_KEY` for public provider listings.
- Twilio `AC...` Account SID, Auth Token, API Key SID/secret, voice/SMS phone number, and preferably a Messaging Service SID.
- `DATA_ENCRYPTION_KEY` (32 random bytes, base64) and `PII_HASH_SALT` before `PRODUCT_MODE=live`.
- Public HTTPS `APP_BASE_URL`.

The Twilio credential that begins with `SK` is an API Key SID, not the required `AC` Account SID. ElevenLabs native number import and Twilio webhook verification require the Account SID and Auth Token.

Any secret pasted into chat should be revoked and replaced before use.

## Connect agent and phone

Both setup scripts are dry-run by default:

```bash
npm run setup:agent
npm run setup:phone
```

After reviewing output and filling secure environment values:

```bash
npm run setup:agent -- --apply
npm run setup:phone -- --apply
```

`setup:agent` creates/updates authenticated ElevenLabs webhook tools, applies `config/voia-agent-prompt.md`, and preserves existing tool IDs. `setup:phone` imports the Twilio number into ElevenLabs for native inbound voice and points inbound SMS to this app.

## Architecture

```text
Web voice/chat ──> /api/elevenlabs/token ──> ElevenLabs agent
Twilio voice ──────────────────────────────> ElevenLabs native phone integration
Twilio SMS ─────> signed app webhook
ElevenLabs tools ─> authenticated provider/search/request APIs
Nimble ─────────> sanitized specialty + coarse location only
App APIs ───────> D1: minimized appointment, consent, delivery, webhook records
```

The app never sends patient identity, contact information, or free-text symptoms to Nimble. It never persists raw ElevenLabs audio or transcript. In demo mode, contact details are discarded after the request and only a keyed patient hash plus initials are stored. In live mode, contact storage requires AES-256-GCM encryption.

## Main routes

| Route | Purpose |
|---|---|
| `POST /api/elevenlabs/token` | Public-agent fallback or private WebRTC token |
| `POST /api/providers/search` | Rate-limited public provider lookup |
| `POST /api/appointments` | Emergency-gated pending request |
| `POST /api/tools/providers/search` | Authenticated ElevenLabs provider tool |
| `POST /api/tools/appointments/request` | Authenticated agent request tool |
| `POST /api/tools/medical-info` | Allowlisted CDC/NIH/MedlinePlus/WHO source search |
| `POST /api/webhooks/twilio/*` | Signed SMS, delivery, and optional custom voice webhooks |
| `POST /api/webhooks/elevenlabs` | Signed, idempotent post-call receipt; no transcript storage |
| `GET /api/health` | Non-secret integration readiness |

## Database

Schema lives in `db/schema.ts`; generated migration lives in `drizzle/0000_nifty_deathstrike.sql`. Local/runtime initialization uses individual prepared D1 statements. Hosting owns the actual D1 binding named `DB`.

```bash
npm run db:generate
```

## Verify

```bash
npm run lint
npx tsc --noEmit
npm test
```

## Before a real launch

- Rotate exposed credentials; use a secrets manager.
- Execute Twilio and ElevenLabs BAAs; enable ElevenLabs Zero Retention.
- Choose HIPAA-eligible hosting/monitoring and approve retention/deletion policy.
- Add patient authentication/OTP before exposing history.
- Complete A2P 10DLC or toll-free verification, STOP/START/HELP handling, geo-permissions, and rate controls.
- Integrate a real scheduling source; keep all requests `pending_provider` until upstream confirmation.
- Complete clinical/legal review before enabling any screening or disease-risk feature.
- Replace preview privacy/terms copy with counsel-approved policies.

Twilio Programmable Messaging provides SMS/MMS, not ordinary iMessage. Apple Messages for Business would require a separate integration.
