import { getRuntimeBindings } from "@/lib/runtime-env";

let schemaReady: Promise<void> | null = null;

export function getD1(): D1Database {
  const binding = getRuntimeBindings().DB as D1Database | undefined;
  if (!binding) {
    throw new Error("Database binding unavailable");
  }
  return binding;
}

export async function ensureDatabase(): Promise<void> {
  if (schemaReady) return schemaReady;

  const db = getD1();
  const pending: Promise<void> = db
    .batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS appointment_requests (
        id TEXT PRIMARY KEY,
        patient_key TEXT NOT NULL,
        patient_initials TEXT NOT NULL,
        encrypted_contact TEXT,
        specialty TEXT NOT NULL,
        provider_id TEXT,
        provider_name TEXT,
        facility_name TEXT,
        provider_phone TEXT,
        provider_website TEXT,
        address TEXT,
        location TEXT NOT NULL,
        modality TEXT NOT NULL,
        requested_date TEXT NOT NULL,
        time_window TEXT NOT NULL,
        timezone TEXT NOT NULL,
        reason_category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_provider',
        source TEXT NOT NULL DEFAULT 'web',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS appointment_patient_idx ON appointment_requests(patient_key)"),
      db.prepare("CREATE INDEX IF NOT EXISTS appointment_created_idx ON appointment_requests(created_at)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS consent_events (
        id TEXT PRIMARY KEY,
        patient_key TEXT NOT NULL,
        appointment_id TEXT,
        care_data_granted INTEGER NOT NULL,
        screening_granted INTEGER NOT NULL,
        sms_granted INTEGER NOT NULL,
        policy_version TEXT NOT NULL,
        channel TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS consent_patient_idx ON consent_events(patient_key)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        appointment_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        provider_message_id TEXT,
        status TEXT NOT NULL,
        error_code TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS notification_appointment_idx ON notifications(appointment_id)"),
      db.prepare("CREATE INDEX IF NOT EXISTS notification_provider_id_idx ON notifications(provider_message_id)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS webhook_receipts (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        external_id TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS webhook_external_idx ON webhook_receipts(provider, external_id)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        window_started_at INTEGER NOT NULL
      )`),
    ])
    .then(() => undefined)
    .catch((error: unknown) => {
      schemaReady = null;
      throw error;
    });
  schemaReady = pending;
  return pending;
}
