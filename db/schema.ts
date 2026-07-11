import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appointmentRequests = sqliteTable(
  "appointment_requests",
  {
    id: text("id").primaryKey(),
    patientKey: text("patient_key").notNull(),
    patientInitials: text("patient_initials").notNull(),
    encryptedContact: text("encrypted_contact"),
    specialty: text("specialty").notNull(),
    providerId: text("provider_id"),
    providerName: text("provider_name"),
    facilityName: text("facility_name"),
    providerPhone: text("provider_phone"),
    providerWebsite: text("provider_website"),
    address: text("address"),
    location: text("location").notNull(),
    modality: text("modality").notNull(),
    requestedDate: text("requested_date").notNull(),
    timeWindow: text("time_window").notNull(),
    timezone: text("timezone").notNull(),
    reasonCategory: text("reason_category").notNull(),
    status: text("status").notNull().default("pending_provider"),
    source: text("source").notNull().default("web"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("appointment_patient_idx").on(table.patientKey),
    index("appointment_created_idx").on(table.createdAt),
  ],
);

export const consentEvents = sqliteTable(
  "consent_events",
  {
    id: text("id").primaryKey(),
    patientKey: text("patient_key").notNull(),
    appointmentId: text("appointment_id"),
    careDataGranted: integer("care_data_granted", { mode: "boolean" }).notNull(),
    screeningGranted: integer("screening_granted", { mode: "boolean" }).notNull(),
    smsGranted: integer("sms_granted", { mode: "boolean" }).notNull(),
    policyVersion: text("policy_version").notNull(),
    channel: text("channel").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("consent_patient_idx").on(table.patientKey)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id").notNull(),
    channel: text("channel").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull(),
    errorCode: text("error_code"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("notification_appointment_idx").on(table.appointmentId),
    index("notification_provider_id_idx").on(table.providerMessageId),
  ],
);

export const webhookReceipts = sqliteTable(
  "webhook_receipts",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("webhook_external_idx").on(table.provider, table.externalId)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStartedAt: integer("window_started_at").notNull(),
});
