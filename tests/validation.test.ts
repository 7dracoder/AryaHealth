import assert from "node:assert/strict";
import test from "node:test";
import { appointmentRequestSchema } from "../lib/validation";

const validRequest = {
  fullName: "Test Patient",
  phone: "+12125550123",
  email: "patient@example.com",
  location: "Boston, MA",
  specialty: "Primary care",
  reason: "Routine annual visit",
  reasonCategory: "Primary care",
  modality: "either",
  requestedDate: "2030-01-01",
  timeWindow: "morning",
  timezone: "America/New_York",
  consent: { careData: true, screening: false, sms: false },
  source: "web",
};

test("accepts a valid minimized appointment request", () => {
  const parsed = appointmentRequestSchema.parse(validRequest);
  assert.equal(parsed.consent.careData, true);
  assert.equal(parsed.phone, "+12125550123");
});

test("requires explicit care-data consent", () => {
  assert.equal(
    appointmentRequestSchema.safeParse({
      ...validRequest,
      consent: { ...validRequest.consent, careData: false },
    }).success,
    false,
  );
});

test("requires E.164 phone format", () => {
  assert.equal(appointmentRequestSchema.safeParse({ ...validRequest, phone: "212-555-0123" }).success, false);
});
