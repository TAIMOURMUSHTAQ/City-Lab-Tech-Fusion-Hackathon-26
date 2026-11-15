import { z } from "zod";

/** Biological sex values the reference files distinguish. */
export const BiologicalSexSchema = z.enum(["Male", "Female"]);
export type BiologicalSex = z.infer<typeof BiologicalSexSchema>;

export type Demographic = "age" | "biologicalSex";

export interface Patient {
  /** Stable identifier: the MRN when present, otherwise a hash-free placeholder. */
  id: string;
  name: string;
  age: number | null;
  biologicalSex: BiologicalSex | null;
  mrn: string | null;
  issueDate: string | null;
}

export type DemographicSource = "report" | "user" | "missing";

/** Final classification shown to the user. `urgent` takes precedence when a critical threshold is crossed. */
export type Classification =
  | "normal"
  | "low"
  | "high"
  | "urgent"
  | "needs_demographics"
  | "cannot_classify"
  | "invalid";

/** Ordinary reference-range status, evaluated independently of urgency. */
export type RangeStatus = Exclude<Classification, "urgent">;

export interface SourceRef {
  file: string;
  /** Verbatim line from the source file. */
  excerpt: string;
}

export interface NumericReferenceRange {
  kind: "numeric";
  min: number;
  max: number;
  unit: string | null;
  sex: BiologicalSex | "All";
  ageMin: number;
  ageMax: number;
  source: SourceRef;
}

export interface QualitativeReferenceRange {
  kind: "qualitative";
  expected: string;
  sex: BiologicalSex | "All";
  ageMin: number;
  ageMax: number;
  source: SourceRef;
}

export type ReferenceRange = NumericReferenceRange | QualitativeReferenceRange;

export interface UrgentThreshold {
  canonicalTestName: string;
  direction: "less_than" | "greater_than";
  value: number;
  unit: string;
  source: SourceRef;
}

export interface UnitConversion {
  canonicalTestName: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  source: SourceRef;
}

/** A result as found in the report, before any interpretation. */
export interface RawResult {
  rawTestName: string;
  rawValue: string;
  rawUnit: string | null;
  /** 1-based line number in the input document. */
  line: number;
  format: "table" | "bullet" | "key_value" | "paired_lines" | "arrow";
}

export type ReasonCode =
  | "unknown_test"
  | "no_range_for_test"
  | "unsupported_unit"
  | "no_range_for_demographics"
  | "missing_demographics"
  | "invalid_value"
  | "qualitative_mismatch";

export interface LabResult {
  rawTestName: string;
  canonicalTestName: string | null;
  rawValue: string;
  /** Numeric value in the reference unit, or the qualitative text; null if invalid/unconvertible. */
  normalizedValue: number | string | null;
  rawUnit: string | null;
  normalizedUnit: string | null;
  conversion: UnitConversion | null;
  classification: Classification;
  rangeStatus: RangeStatus;
  reason: ReasonCode | null;
  missingDemographics: Demographic[];
  referenceRange: ReferenceRange | null;
  urgent: boolean;
  urgentReason: string | null;
  urgentThreshold: UrgentThreshold | null;
  aliasSource: SourceRef | null;
  sourceFile: string | null;
  sourceExcerpt: string | null;
  line: number;
}

export interface ExplainedResult extends LabResult {
  explanation: string;
  explanationSource: "deterministic" | "llm";
  doctorQuestions: string[];
}

export interface Analysis {
  patient: Patient;
  demographicsSource: { age: DemographicSource; biologicalSex: DemographicSource };
  /** Demographics absent from the report and not supplied by the user. */
  missingDemographics: Demographic[];
  results: ExplainedResult[];
  urgentCount: number;
  warnings: string[];
}

// ---------- External input validation ----------

export const MAX_MARKDOWN_BYTES = 200_000;

export const DemographicOverridesSchema = z
  .object({
    age: z.number().int().min(0).max(130).optional(),
    biologicalSex: BiologicalSexSchema.optional(),
  })
  .strict();
export type DemographicOverrides = z.infer<typeof DemographicOverridesSchema>;

export const ReportSourceSchema = z.union([
  z.object({ fixtureId: z.string().regex(/^P\d{3}$/, "fixtureId must look like P001") }).strict(),
  z.object({ markdown: z.string().min(1, "Report is empty").max(MAX_MARKDOWN_BYTES, "Report is too large") }).strict(),
]);
export type ReportSource = z.infer<typeof ReportSourceSchema>;

export const AnalyzeRequestSchema = z
  .object({
    source: ReportSourceSchema,
    demographics: DemographicOverridesSchema.optional(),
  })
  .strict();
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const AskRequestSchema = z
  .object({
    source: ReportSourceSchema,
    demographics: DemographicOverridesSchema.optional(),
    question: z.string().trim().min(1, "Question is empty").max(500, "Question is too long"),
  })
  .strict();
export type AskRequest = z.infer<typeof AskRequestSchema>;

export interface AskResponse {
  status: "answered" | "refused";
  answer: string;
}

export type ErrorCode =
  | "invalid_request"
  | "fixture_not_found"
  | "missing_patient_name"
  | "no_results_section"
  | "no_results_found"
  | "demographic_conflict"
  | "internal_error";

export interface ApiError {
  error: { code: ErrorCode; message: string };
}

/** Domain error with a stable code the API maps to an HTTP response. */
export class ReportError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReportError";
  }
}
