import { getRuntimeBindings } from "@/lib/runtime-env";

let schemaReady: Promise<void> | null = null;

export function getD1(): D1Database {
  const binding = getRuntimeBindings().DB as D1Database | undefined;
  if (!binding) {
    throw new Error("Database binding unavailable");
  }
  return binding;
}

async function addColumnIfMissing(db: D1Database, sql: string): Promise<void> {
  try {
    await db.prepare(sql).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate column|already exists/i.test(message)) throw error;
  }
}

export async function ensureDatabase(): Promise<void> {
  if (schemaReady) return schemaReady;

  const db = getD1();
  const pending = (async () => {
    try {
      await db.batch([
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
          issue_kind TEXT NOT NULL DEFAULT 'new',
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
        db.prepare(`CREATE TABLE IF NOT EXISTS registered_patients (
          patient_key TEXT PRIMARY KEY,
          phone_hash TEXT NOT NULL UNIQUE,
          phone_last4 TEXT NOT NULL,
          encrypted_contact TEXT,
          care_data_granted INTEGER NOT NULL,
          screening_granted INTEGER NOT NULL,
          sms_granted INTEGER NOT NULL,
          policy_version TEXT NOT NULL,
          verified_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`),
        db.prepare("CREATE INDEX IF NOT EXISTS registered_phone_hash_idx ON registered_patients(phone_hash)"),
        db.prepare(`CREATE TABLE IF NOT EXISTS otp_challenges (
          id TEXT PRIMARY KEY,
          phone_hash TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          care_data_granted INTEGER NOT NULL,
          screening_granted INTEGER NOT NULL,
          sms_granted INTEGER NOT NULL,
          email TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`),
        db.prepare("CREATE INDEX IF NOT EXISTS otp_phone_hash_idx ON otp_challenges(phone_hash)"),
      ]);
      // Existing local/demo DBs created before issue_kind need a soft migrate.
      await addColumnIfMissing(
        db,
        "ALTER TABLE appointment_requests ADD COLUMN issue_kind TEXT NOT NULL DEFAULT 'new'",
      );
    } catch (error) {
      schemaReady = null;
      throw error;
    }
  })();

  schemaReady = pending;
  return pending;
}
