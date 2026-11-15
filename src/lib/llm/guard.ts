import type { ExplainedResult } from "@/lib/domain/types";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function llmConfig(env: Readonly<Record<string, string | undefined>> = process.env): LlmConfig | null {
  const baseUrl = env.LLM_API_BASE_URL?.trim();
  const apiKey = env.LLM_API_KEY?.trim();
  const model = env.LLM_MODEL?.trim();
  if (!baseUrl || !apiKey || !model) return null;
  if (!/^https:\/\//.test(baseUrl)) return null; // never send data over plaintext
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model };
}

const FORBIDDEN = /\byou have\b|\bdiagnos(?:is|ed|e)\b|\bdisease\b|\bsyndrome\b|\bdisorder\b/i;
const numbersIn = (text: string): string[] => (text.replace(/(\d),(\d)/g, "$1$2").match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));

/** Accepts LLM prose only if it introduces no new numbers, makes no diagnostic claims and keeps required safety wording. */
export function verifyRephrase(text: string, r: ExplainedResult, allowedText: string): boolean {
  if (FORBIDDEN.test(text)) return false;
  const allowed = new Set(numbersIn(allowedText));
  if (!numbersIn(text).every((n) => allowed.has(n))) return false;
  if ((r.rangeStatus === "low" || r.rangeStatus === "high" || r.urgent) && !/licensed clinician/i.test(text)) return false;
  if (r.urgent && !/doctor/i.test(text)) return false;
  return true;
}

