export type RuntimeBindings = Record<string, unknown> & { DB?: unknown };

declare global {
  var __VOIA_RUNTIME_BINDINGS__: RuntimeBindings | undefined;
}

export function getRuntimeBindings(): RuntimeBindings {
  return globalThis.__VOIA_RUNTIME_BINDINGS__ ?? {};
}

export function getEnv(name: string): string | undefined {
  const value = getRuntimeBindings()[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  const nodeValue = typeof process !== "undefined" ? process.env[name] : undefined;
  return nodeValue?.trim() || undefined;
}

export function envFlag(name: string, fallback = false): boolean {
  const value = getEnv(name);
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const ELEVENLABS_AGENT_ID =
  getEnv("ELEVENLABS_AGENT_ID") ?? "agent_5501kx8wda1pendvh6xvme7fxn78";
