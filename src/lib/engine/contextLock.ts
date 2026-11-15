import type { Analysis, AskResponse, ExplainedResult } from "@/lib/domain/types";
import type { CanonicalTest } from "@/lib/knowledge/tables";
import { namesFor } from "./aliases";

export interface KnownPatient {
  name: string;
  mrn: string | null;
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (s: string, flags = "i"): RegExp => new RegExp(`(?<![\\w-])${escape(s)}(?![\\w-])`, flags);

const GENERIC_OTHER_PATIENT = [
  /\b(another|other|different|second)\s+(patient|person|people|report|record)s?\b/i,
  /\bsomeone\s+else\b/i,
  /\banyone\s+else\b/i,
  /\b(all|every)\s+patients?\b/i,
];
const MRN_PATTERN = /\bCLD-P\d+(?:-\d+)?\b/gi;
const PATIENT_ID_PATTERN = /\bP\d{3}\b/gi;
const DIAGNOSIS_REQUEST = /\b(do i have|have i got|diagnos\w*|what disease|what illness|am i (sick|ill))\b/i;

/** Report-style patient id (e.g. "P001") embedded in a CityLab MRN, if any. */
export function patientIdFromMrn(mrn: string | null): string | null {
  const match = mrn ? /CLD-(P\d{3})/i.exec(mrn) : null;
  return match?.[1]?.toUpperCase() ?? null;
}

/** True when the question refers to any patient other than the one currently selected. */
export function mentionsOtherPatient(question: string, current: KnownPatient, others: readonly KnownPatient[]): boolean {
  if (GENERIC_OTHER_PATIENT.some((re) => re.test(question))) return true;

  const currentMrn = current.mrn?.toUpperCase() ?? null;
  const currentId = patientIdFromMrn(current.mrn);
  for (const m of question.match(MRN_PATTERN) ?? []) if (m.toUpperCase() !== currentMrn) return true;
  for (const m of question.match(PATIENT_ID_PATTERN) ?? []) if (m.toUpperCase() !== currentId) return true;

  const currentTokens = new Set(current.name.toLowerCase().split(/\s+/));
  for (const other of others) {
    if (other.name.toLowerCase() === current.name.toLowerCase() && other.mrn === current.mrn) continue;
    if (word(other.name).test(question)) return true;
    const [first, ...rest] = other.name.split(/\s+/);
    const last = rest.at(-1);
    // First names case-insensitive; surnames case-sensitive (several are ordinary words, e.g. "Child", "Drew").
    if (first && !currentTokens.has(first.toLowerCase()) && word(first).test(question)) return true;
    if (last && !currentTokens.has(last.toLowerCase()) && word(last, "").test(question)) return true;
  }
  return false;
}

function matchingResults(question: string, results: readonly ExplainedResult[]): ExplainedResult[] {
  return results.filter((r) => {
    const names = new Set<string>([r.rawTestName]);
    if (r.canonicalTestName) for (const n of namesFor(r.canonicalTestName as CanonicalTest)) names.add(n);
    return [...names].some((n) => word(n).test(question));
  });
}

export const CLINICIAN_REMINDER = "Only a licensed clinician can diagnose a medical condition.";

/**
 * Deterministic, context-locked answers. It never consults other reports' results and the refusal
 * message never confirms whether another patient exists.
 */
export function answerQuestion(question: string, analysis: Analysis, others: readonly KnownPatient[]): AskResponse {
  const current: KnownPatient = { name: analysis.patient.name, mrn: analysis.patient.mrn };
  if (mentionsOtherPatient(question, current, others)) {
    return {
      status: "refused",
      answer: `This session is locked to the report for ${analysis.patient.name}. I can't share, compare or confirm any information about other patients.`,
    };
  }

  const matches = matchingResults(question, analysis.results);
  const lines: string[] = [];
  if (DIAGNOSIS_REQUEST.test(question)) {
    lines.push(`I can't diagnose conditions. I can only explain how each value compares with the CityLab reference files. ${CLINICIAN_REMINDER}`);
  }
  if (matches.length > 0) {
    lines.push(...matches.map((r) => r.explanation));
  } else if (lines.length === 0) {
    const tests = analysis.results.map((r) => r.canonicalTestName ?? r.rawTestName).join(", ");
    lines.push(`I can only answer questions about the results in this report (${tests}). Try asking about one of those tests.`);
  }
  return { status: "answered", answer: lines.join("\n\n") };
}
