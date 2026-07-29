import { createHash } from "node:crypto";
import { TtlCache } from "@/lib/server/ttl-cache";
import type { MedicalAssistantGeneration, MedicalAssistantInput } from "@/lib/ai/medical-assistant";

const cache = new TtlCache<MedicalAssistantGeneration>({ ttlMs: 5 * 60_000, maxEntries: 300 });
const pending = new Map<string, Promise<MedicalAssistantGeneration>>();

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

export function medicalDraftCacheKey(input: MedicalAssistantInput, model: string): string {
  return createHash("sha256").update(JSON.stringify({ model, input: stable(input) })).digest("hex");
}

export function readMedicalDraftCache(key: string) {
  return cache.get(key);
}

export function writeMedicalDraftCache(key: string, value: MedicalAssistantGeneration) {
  cache.set(key, value);
}

export function getPendingMedicalDraft(key: string) {
  return pending.get(key);
}

export function setPendingMedicalDraft(key: string, value: Promise<MedicalAssistantGeneration>) {
  pending.set(key, value);
  value.finally(() => pending.delete(key)).catch(() => undefined);
}
