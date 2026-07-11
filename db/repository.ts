import { desc, eq } from "drizzle-orm";
import { getReadyDb } from ".";
import { appointmentRequests, consentEvents, notifications, webhookReceipts } from "./schema";

export type AppointmentRow = typeof appointmentRequests.$inferSelect;

export async function insertAppointment(
  appointment: typeof appointmentRequests.$inferInsert,
  consent: Omit<typeof consentEvents.$inferInsert, "id" | "appointmentId">,
): Promise<AppointmentRow> {
  const db = await getReadyDb();
  await db.insert(appointmentRequests).values(appointment);
  await db.insert(consentEvents).values({
    ...consent,
    id: crypto.randomUUID(),
    appointmentId: appointment.id,
  });
  const [row] = await db
    .select()
    .from(appointmentRequests)
    .where(eq(appointmentRequests.id, appointment.id))
    .limit(1);
  if (!row) throw new Error("Appointment request could not be saved");
  return row;
}

export async function listAppointments(patientKey: string): Promise<AppointmentRow[]> {
  const db = await getReadyDb();
  return db
    .select()
    .from(appointmentRequests)
    .where(eq(appointmentRequests.patientKey, patientKey))
    .orderBy(desc(appointmentRequests.createdAt))
    .limit(20);
}

export async function insertNotification(input: {
  appointmentId: string;
  providerMessageId?: string;
  status: string;
  errorCode?: string;
}): Promise<void> {
  const db = await getReadyDb();
  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    appointmentId: input.appointmentId,
    channel: "sms",
    providerMessageId: input.providerMessageId,
    status: input.status,
    errorCode: input.errorCode,
  });
}

export async function updateNotificationStatus(input: {
  providerMessageId: string;
  status: string;
  errorCode?: string;
}): Promise<void> {
  const db = await getReadyDb();
  await db
    .update(notifications)
    .set({
      status: input.status,
      errorCode: input.errorCode,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(notifications.providerMessageId, input.providerMessageId));
}

export async function recordWebhookReceipt(input: {
  provider: string;
  externalId: string;
  payloadHash: string;
  status: string;
}): Promise<boolean> {
  const db = await getReadyDb();
  const id = `${input.provider}:${input.externalId}:${input.status}`;
  const rows = await db
    .insert(webhookReceipts)
    .values({ id, ...input })
    .onConflictDoNothing()
    .returning({ id: webhookReceipts.id });
  return rows.length > 0;
}
