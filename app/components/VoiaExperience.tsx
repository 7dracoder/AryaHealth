"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Globe2,
  HeartPulse,
  Hospital,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Mic,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  Stethoscope,
  Volume2,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

const agentId = "agent_5501kx8wda1pendvh6xvme7fxn78";

const specialtyOptions = [
  "Primary care",
  "Neurology",
  "Pulmonology",
  "Cardiology",
  "Mental health",
  "Speech-language pathology",
  "Ear, nose and throat",
] as const;

type Specialty = (typeof specialtyOptions)[number];
type ChatMessage = { id: string; role: "agent" | "user" | "system"; text: string };
type Provider = {
  id: string;
  name: string;
  facilityName?: string;
  address?: string;
  phone?: string;
  website?: string;
  sourceUrl?: string;
  rating?: number;
  reviewCount?: number;
  categories: string[];
  availability: "unknown";
};

type SessionPayload =
  | { mode: "public"; agentId: string }
  | { mode: "private"; conversationToken: string };

const initialMessage: ChatMessage = {
  id: "welcome",
  role: "agent",
  text: "Hi, I’m Voia. I can help you find a clinician and request an appointment. What kind of care are you looking for?",
};

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function AssistantCard({
  careConsent,
  setCareConsent,
  screeningConsent,
  setScreeningConsent,
}: {
  careConsent: boolean;
  setCareConsent: (value: boolean) => void;
  screeningConsent: boolean;
  setScreeningConsent: (value: boolean) => void;
}) {
  const [tab, setTab] = useState<"voice" | "chat">("voice");
  const [language, setLanguage] = useState("English");
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const pendingText = useRef("");
  const lastSent = useRef("");
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => setError(""),
    onDisconnect: (details) => {
      if (details.reason === "error") setError("Connection ended. Please try again.");
    },
    onError: (message) => setError(message || "Assistant connection failed."),
    onMessage: ({ message, role }) => {
      if (!message.trim()) return;
      if (role === "user" && lastSent.current === message.trim()) {
        lastSent.current = "";
        return;
      }
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role, text: message.trim() },
      ]);
    },
    clientTools: {
      openBookingForm: () => {
        scrollTo("find-care");
        return "Appointment request form opened";
      },
    },
  });

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (conversation.status === "connected" && pendingText.current) {
      const text = pendingText.current;
      pendingText.current = "";
      lastSent.current = text;
      conversation.sendUserMessage(text);
    }
  }, [conversation, conversation.status]);

  async function startSession(textOnly: boolean, firstText?: string) {
    if (!careConsent) {
      setError("Please agree to care-assistance data use before starting.");
      return;
    }
    setError("");
    if (firstText) pendingText.current = firstText;

    try {
      if (!textOnly) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
      const response = await fetch("/api/elevenlabs/token", { method: "POST" });
      const payload = (await response.json()) as SessionPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Assistant unavailable");

      const shared = {
        textOnly,
        dynamicVariables: {
          preferred_language: language,
          screening_consent: screeningConsent,
          care_data_consent: careConsent,
          channel: textOnly ? "web_chat" : "web_voice",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
      if (payload.mode === "private") {
        conversation.startSession({
          ...shared,
          conversationToken: payload.conversationToken,
          connectionType: "webrtc",
        });
      } else {
        conversation.startSession({
          ...shared,
          agentId: payload.agentId || agentId,
          connectionType: textOnly ? "websocket" : "webrtc",
        });
      }
    } catch (caught) {
      pendingText.current = "";
      setError(caught instanceof Error ? caught.message : "Assistant unavailable");
    }
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
    setDraft("");
    if (conversation.status === "connected") {
      lastSent.current = text;
      conversation.sendUserMessage(text);
    } else {
      void startSession(true, text);
    }
  }

  const connected = conversation.status === "connected";
  const connecting = conversation.status === "connecting";
  const speaking = connected && conversation.isSpeaking;
  const statusText = connecting
    ? "Connecting…"
    : connected
      ? speaking
        ? "Voia is speaking"
        : "Listening"
      : "Ready when you are";

  return (
    <section className="assistant-card" id="assistant" aria-label="Talk with Voia">
      <div className="assistant-card-top">
        <div className="assistant-title-wrap">
          <span className={`status-dot ${connected ? "is-live" : ""}`} />
          <div>
            <p className="assistant-name">Voia care assistant</p>
            <p className="assistant-status">{statusText}</p>
          </div>
        </div>
        <label className="language-select">
          <Globe2 size={15} aria-hidden="true" />
          <span className="sr-only">Preferred language</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option>English</option>
            <option>Español</option>
            <option>हिन्दी</option>
            <option>Français</option>
            <option>普通话</option>
          </select>
        </label>
      </div>

      <div className="channel-tabs" role="tablist" aria-label="Conversation channel">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "voice"}
          className={tab === "voice" ? "active" : ""}
          onClick={() => setTab("voice")}
        >
          <Mic size={16} aria-hidden="true" /> Voice
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "chat"}
          className={tab === "chat" ? "active" : ""}
          onClick={() => setTab("chat")}
        >
          <MessageCircle size={16} aria-hidden="true" /> Chat
        </button>
      </div>

      {tab === "voice" ? (
        <div className="voice-stage" role="tabpanel">
          <div className={`voice-orbit ${connected ? "connected" : ""} ${speaking ? "speaking" : ""}`}>
            <span className="orbit-ring ring-one" />
            <span className="orbit-ring ring-two" />
            <button
              type="button"
              className="voice-button"
              onClick={() => (connected ? conversation.endSession() : void startSession(false))}
              disabled={connecting}
              aria-label={connected ? "End voice conversation" : "Start voice conversation"}
            >
              {connected ? <Square size={22} fill="currentColor" /> : <Mic size={27} />}
            </button>
          </div>
          <p className="voice-prompt">
            {connected ? (speaking ? "Speaking in your preferred language" : "Go ahead — I’m listening") : "Tap to talk with Voia"}
          </p>
          <p className="voice-subprompt">Short turns · You can stop anytime</p>
          <div className="voice-suggestion-row" aria-label="Things you can ask">
            <button type="button" onClick={() => setTab("chat")}>Find a neurologist</button>
            <button type="button" onClick={() => scrollTo("find-care")}>Request a visit</button>
          </div>
        </div>
      ) : (
        <div className="chat-stage" role="tabpanel">
          <div className="message-list" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                {message.text}
              </div>
            ))}
            <div ref={transcriptEnd} />
          </div>
          <form className="chat-composer" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="chat-message">Message Voia</label>
            <input
              id="chat-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type what you need help with…"
              maxLength={800}
            />
            <button type="submit" aria-label="Send message" disabled={!draft.trim() || connecting}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {error && <p className="inline-error" role="alert"><CircleAlert size={15} /> {error}</p>}

      <div className="consent-panel">
        <label>
          <input
            type="checkbox"
            checked={careConsent}
            onChange={(event) => setCareConsent(event.target.checked)}
          />
          <span><strong>Care assistance</strong> — use my responses to help with care navigation.</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={screeningConsent}
            onChange={(event) => setScreeningConsent(event.target.checked)}
          />
          <span><strong>Optional screening</strong> — store screening results when a validated tool is available.</span>
        </label>
        <p><LockKeyhole size={13} /> Screening is currently off. Declining never blocks appointment help.</p>
      </div>
    </section>
  );
}

function BookingWorkspace({
  careConsent,
  setCareConsent,
  screeningConsent,
}: {
  careConsent: boolean;
  setCareConsent: (value: boolean) => void;
  screeningConsent: boolean;
}) {
  const [specialty, setSpecialty] = useState<Specialty>("Primary care");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [modality, setModality] = useState("either");
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [timeWindow, setTimeWindow] = useState("anytime");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | undefined>();
  const [searching, setSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState("");
  const [emergency, setEmergency] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    status: string;
    disclaimer: string;
    sms: { sent: boolean; status: string };
  } | null>(null);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const looksUrgent = /\b(can'?t breathe|severe chest pain|face droop|one-sided weakness|kill myself|suicid|seizure)\b/i;

  async function findProviders() {
    setError("");
    setEmergency("");
    setSearchAttempted(true);
    if (looksUrgent.test(reason)) {
      setEmergency("These symptoms could be an emergency. Call your local emergency number now. Do not wait for a routine appointment.");
      return;
    }
    if (location.trim().length < 2) {
      setError("Add your city and state before searching.");
      return;
    }

    setSearching(true);
    try {
      const response = await fetch("/api/providers/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ location, specialty }),
      });
      const payload = (await response.json()) as { providers?: Provider[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Provider search unavailable");
      setProviders(payload.providers ?? []);
      setSelectedProvider(undefined);
    } catch (caught) {
      setProviders([]);
      setError(caught instanceof Error ? caught.message : "Provider search unavailable");
    } finally {
      setSearching(false);
    }
  }

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    setError("");
    setEmergency("");
    if (!careConsent) {
      setError("Care-assistance consent is required to save this request.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          location,
          specialty,
          reason,
          reasonCategory: specialty,
          modality,
          requestedDate: date,
          timeWindow,
          timezone,
          provider: selectedProvider,
          consent: { careData: careConsent, screening: screeningConsent, sms: smsConsent },
          source: "web",
        }),
      });
      const payload = (await response.json()) as {
        appointment?: typeof result;
        error?: string;
        emergency?: boolean;
        guidance?: string;
        issues?: Array<{ message: string }>;
      };
      if (payload.emergency) {
        setEmergency(payload.guidance ?? "Call your local emergency number now.");
        return;
      }
      if (!response.ok || !payload.appointment) {
        throw new Error(payload.issues?.[0]?.message ?? payload.error ?? "Request could not be saved");
      }
      setResult(payload.appointment);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request could not be saved");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="request-success" role="status">
        <div className="success-icon"><CheckCircle2 size={34} /></div>
        <p className="eyebrow">Request saved</p>
        <h3>Next: provider confirmation</h3>
        <p className="confirmation-id">{result.id}</p>
        <p>{result.disclaimer}</p>
        <div className="success-summary">
          <span><Stethoscope size={16} /> {specialty}</span>
          <span><CalendarDays size={16} /> {date} · {timeWindow}</span>
          <span><MapPin size={16} /> {selectedProvider?.name ?? location}</span>
        </div>
        <p className="muted-copy">
          {smsConsent
            ? result.sms.sent
              ? "Generic SMS receipt queued."
              : "SMS could not be sent; keep this request ID."
            : "No SMS requested. Keep this request ID."}
        </p>
        <button type="button" className="secondary-button" onClick={() => setResult(null)}>
          Start another request
        </button>
      </div>
    );
  }

  return (
    <form className="booking-grid" onSubmit={submitRequest}>
      <div className="booking-form-card">
        <div className="form-section-heading">
          <span>1</span>
          <div><h3>Tell us what you need</h3><p>Enough detail to guide the search — not a diagnosis.</p></div>
        </div>
        <div className="field-grid">
          <label className="field">
            <span>Specialty</span>
            <select value={specialty} onChange={(event) => setSpecialty(event.target.value as Specialty)}>
              {specialtyOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="field">
            <span>City and state</span>
            <div className="input-with-icon"><MapPin size={17} /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Boston, MA" maxLength={120} /></div>
          </label>
          <label className="field full">
            <span>What’s going on?</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Briefly describe the reason for your visit and when it started." maxLength={1000} required />
          </label>
        </div>
        {emergency && <div className="emergency-card" role="alert"><CircleAlert size={20} /><div><strong>Get urgent help now</strong><p>{emergency}</p></div></div>}
        <button className="search-button" type="button" onClick={() => void findProviders()} disabled={searching || !location.trim()}>
          {searching ? <span className="button-spinner" /> : <Search size={18} />}
          {searching ? "Searching nearby care…" : "Find nearby providers"}
        </button>

        <div className="form-divider" />
        <div className="form-section-heading">
          <span>2</span>
          <div><h3>Choose a time window</h3><p>Provider must confirm a specific slot.</p></div>
        </div>
        <div className="field-grid three">
          <label className="field">
            <span>Visit type</span>
            <select value={modality} onChange={(event) => setModality(event.target.value)}>
              <option value="either">Either</option>
              <option value="in_person">In person</option>
              <option value="telehealth">Telehealth</option>
            </select>
          </label>
          <label className="field">
            <span>Preferred date</span>
            <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label className="field">
            <span>Time</span>
            <select value={timeWindow} onChange={(event) => setTimeWindow(event.target.value)}>
              <option value="anytime">Anytime</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </label>
        </div>

        <div className="form-divider" />
        <div className="form-section-heading">
          <span>3</span>
          <div><h3>Your contact details</h3><p>Used only for this care request and permitted follow-up.</p></div>
        </div>
        <div className="field-grid">
          <label className="field"><span>Full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required maxLength={120} /></label>
          <label className="field"><span>Phone (E.164)</span><input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="+12125551234" required /></label>
          <label className="field full"><span>Email <small>optional</small></span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={200} /></label>
        </div>
        <div className="booking-consents">
          <label><input type="checkbox" checked={careConsent} onChange={(event) => setCareConsent(event.target.checked)} /><span>I agree to use and store the minimum information needed for this care request. <strong>Required</strong></span></label>
          <label><input type="checkbox" checked={smsConsent} onChange={(event) => setSmsConsent(event.target.checked)} /><span>Send a generic SMS receipt. Standard rates may apply. Reply STOP to opt out.</span></label>
        </div>
        {error && <p className="form-error" role="alert"><CircleAlert size={16} /> {error}</p>}
        <button className="primary-button request-button" type="submit" disabled={submitting || !careConsent}>
          {submitting ? <span className="button-spinner light" /> : <CalendarDays size={18} />}
          {submitting ? "Saving request…" : "Request appointment"}
          {!submitting && <ArrowRight size={17} />}
        </button>
        <p className="booking-disclaimer">This sends a request, not a confirmed booking. No payment or insurance data collected.</p>
      </div>

      <aside className="provider-results" aria-label="Provider results">
        <div className="provider-header">
          <div><p className="eyebrow">Nearby care</p><h3>Choose a provider</h3></div>
          {providers.length > 0 && <span>{providers.length} listings</span>}
        </div>
        {!searchAttempted ? (
          <div className="provider-empty">
            <div className="empty-map"><MapPin size={25} /></div>
            <h4>Start with location</h4>
            <p>We’ll show a small set of nearby public listings. You can also continue with no preference.</p>
          </div>
        ) : searching ? (
          <div className="provider-skeletons" aria-label="Loading providers">
            {[1, 2, 3].map((item) => <div key={item} className="provider-skeleton" />)}
          </div>
        ) : providers.length ? (
          <div className="provider-list">
            <button type="button" className={`no-preference ${!selectedProvider ? "selected" : ""}`} onClick={() => setSelectedProvider(undefined)}>
              <span className="radio-mark">{!selectedProvider && <Check size={14} />}</span>
              <span><strong>No provider preference</strong><small>Let care team help choose</small></span>
            </button>
            {providers.map((provider) => {
              const selected = selectedProvider?.id === provider.id;
              return (
                <article className={`provider-card ${selected ? "selected" : ""}`} key={provider.id}>
                  <button type="button" className="provider-select" onClick={() => setSelectedProvider(provider)} aria-label={`Select ${provider.name}`}>
                    <span className="radio-mark">{selected && <Check size={14} />}</span>
                    <span className="provider-logo"><Hospital size={19} /></span>
                    <span className="provider-main">
                      <strong>{provider.name}</strong>
                      <small>{provider.categories[0] ?? provider.facilityName ?? specialty}</small>
                    </span>
                  </button>
                  {provider.rating !== undefined && <p className="rating"><Star size={14} fill="currentColor" /> {provider.rating.toFixed(1)} {provider.reviewCount !== undefined && <span>({provider.reviewCount})</span>}</p>}
                  {provider.address && <p className="provider-meta"><MapPin size={14} /> {provider.address}</p>}
                  <div className="provider-footer">
                    <span><Clock3 size={13} /> Availability unknown</span>
                    {(provider.sourceUrl || provider.website) && <a href={provider.sourceUrl ?? provider.website} target="_blank" rel="noreferrer">View listing <ChevronRight size={13} /></a>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="provider-empty compact"><Search size={24} /><h4>No listings to show</h4><p>Try a nearby city, or continue with no provider preference.</p></div>
        )}
        <div className="provider-source"><ShieldCheck size={14} /><span>Public listings only. Verify credentials, insurance, and availability directly.</span></div>
      </aside>
    </form>
  );
}

export function VoiaExperience() {
  const [careConsent, setCareConsent] = useState(false);
  const [screeningConsent, setScreeningConsent] = useState(false);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Voia home">
          <span className="brand-mark"><HeartPulse size={20} /></span>
          <span><strong>voia</strong><small>by Arya Health</small></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#safety">Safety & privacy</a>
          <button type="button" onClick={() => scrollTo("find-care")}>Find care <ArrowRight size={15} /></button>
        </nav>
      </header>

      <div className="prototype-banner" role="note">
        <ShieldCheck size={15} />
        <span><strong>Protected preview:</strong> not for emergencies or real private health information until compliance setup is complete.</span>
      </div>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={14} /> Multilingual care navigation</p>
          <h1>Care starts with<br /><em>being heard.</em></h1>
          <p className="hero-lede">
            Speak or type naturally. Voia helps you find the right kind of clinician and send a clear appointment request — calmly, in your language.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => scrollTo("assistant")}><Mic size={18} /> Talk with Voia <ArrowRight size={17} /></button>
            <button className="text-button" type="button" onClick={() => scrollTo("find-care")}>Find care nearby <ChevronRight size={16} /></button>
          </div>
          <div className="hero-proof" aria-label="Voia features">
            <span><CheckCircle2 size={16} /> Voice + chat</span>
            <span><CheckCircle2 size={16} /> Multilingual</span>
            <span><CheckCircle2 size={16} /> Screening is never diagnosis</span>
          </div>
          <div className="emergency-note"><CircleAlert size={18} /><p><strong>Possible emergency?</strong> Call your local emergency number now. Don’t wait for this service.</p></div>
        </div>

        <div className="assistant-wrap">
          <div className="assistant-backdrop backdrop-one" />
          <div className="assistant-backdrop backdrop-two" />
          <ConversationProvider>
            <AssistantCard
              careConsent={careConsent}
              setCareConsent={setCareConsent}
              screeningConsent={screeningConsent}
              setScreeningConsent={setScreeningConsent}
            />
          </ConversationProvider>
          <div className="privacy-chip"><LockKeyhole size={14} /> Consent before storage</div>
        </div>
      </section>

      <section className="capability-strip" aria-label="Service capabilities">
        <div><Volume2 size={20} /><span><strong>Natural conversation</strong><small>Short, calm, one question at a time</small></span></div>
        <div><Globe2 size={20} /><span><strong>Your preferred language</strong><small>Voice and text support</small></span></div>
        <div><Stethoscope size={20} /><span><strong>Right specialty</strong><small>Focused provider options</small></span></div>
        <div><CalendarDays size={20} /><span><strong>Clear next step</strong><small>Request status, never false confirmation</small></span></div>
      </section>

      <section className="care-section" id="find-care">
        <div className="section-heading">
          <p className="eyebrow"><MapPin size={14} /> Find care near you</p>
          <h2>From concern to a clear next step.</h2>
          <p>Share what you need, compare a few public listings, then send a request for provider follow-up.</p>
        </div>
        <BookingWorkspace careConsent={careConsent} setCareConsent={setCareConsent} screeningConsent={screeningConsent} />
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-heading centered">
          <p className="eyebrow"><Sparkles size={14} /> Simple by design</p>
          <h2>Care navigation without the maze.</h2>
        </div>
        <div className="steps-grid">
          <article><span>01</span><div className="step-icon"><MessageCircle size={22} /></div><h3>Tell Voia what you need</h3><p>Use voice or chat. You control optional screening consent separately.</p></article>
          <article><span>02</span><div className="step-icon"><Search size={22} /></div><h3>Review focused options</h3><p>See a small set of public provider listings near your preferred location.</p></article>
          <article><span>03</span><div className="step-icon"><Phone size={22} /></div><h3>Wait for confirmation</h3><p>Your request remains pending until a provider confirms a real appointment slot.</p></article>
        </div>
      </section>

      <section className="safety-section" id="safety">
        <div className="safety-copy">
          <p className="eyebrow"><ShieldCheck size={14} /> Safety & privacy</p>
          <h2>Helpful, careful, and honest about limits.</h2>
          <p>Voia supports care navigation. It does not diagnose, prescribe, or replace emergency services or a licensed clinician.</p>
          <a href="mailto:privacy@arya.health">Ask a privacy question <ArrowRight size={15} /></a>
        </div>
        <div className="safety-list">
          <article><span><CircleAlert size={20} /></span><div><h3>Emergencies come first</h3><p>Red-flag language stops routine booking and directs the patient to local emergency help.</p></div></article>
          <article><span><ShieldCheck size={20} /></span><div><h3>Screening stays off by default</h3><p>No disease inference from voice until a validated model, consent, and clinical controls exist.</p></div></article>
          <article><span><LockKeyhole size={20} /></span><div><h3>Minimum necessary data</h3><p>No raw call audio or transcript stored by this app. Contact data is encrypted when live mode is enabled.</p></div></article>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark"><HeartPulse size={19} /></span><span><strong>voia</strong><small>by Arya Health</small></span></a>
        <p>Care navigation, not medical diagnosis. © 2026 Arya Health.</p>
        <div><a href="#safety">Safety</a><a href="mailto:privacy@arya.health">Privacy</a><a href="mailto:support@arya.health">Support</a></div>
      </footer>
    </main>
  );
}
