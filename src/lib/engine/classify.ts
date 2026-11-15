import type {
  BiologicalSex,
  Demographic,
  LabResult,
  RangeStatus,
  RawResult,
  ReasonCode,
  ReferenceRange,
} from "@/lib/domain/types";
import { REFERENCE_RANGES, URGENT_THRESHOLDS } from "@/lib/knowledge/tables";
import { resolveTestName } from "./aliases";
import { lookupRange } from "./ranges";
import { normalizeUnit } from "./units";
import { evaluateUrgent, type UrgentEvaluation } from "./urgent";

const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

interface Demographics {
  age: number | null;
  biologicalSex: BiologicalSex | null;
}

function base(raw: RawResult): LabResult {
  return {
    rawTestName: raw.rawTestName,
    canonicalTestName: null,
    rawValue: raw.rawValue,
    normalizedValue: null,
    rawUnit: raw.rawUnit,
    normalizedUnit: null,
    conversion: null,
    classification: "cannot_classify",
    rangeStatus: "cannot_classify",
    reason: null,
    missingDemographics: [],
    referenceRange: null,
    urgent: false,
    urgentReason: null,
    urgentThreshold: null,
    aliasSource: null,
    sourceFile: null,
    sourceExcerpt: null,
    line: raw.line,
  };
}

function withStatus(
  result: LabResult,
  rangeStatus: RangeStatus,
  reason: ReasonCode | null,
  urgent: UrgentEvaluation | null = null,
): LabResult {
  const isUrgent = urgent?.urgent ?? false;
  return {
    ...result,
    rangeStatus,
    reason,
    urgent: isUrgent,
    urgentReason: urgent?.reason ?? null,
    urgentThreshold: urgent?.threshold ?? null,
    classification: isUrgent ? "urgent" : rangeStatus,
  };
}

function withRange(result: LabResult, range: ReferenceRange): LabResult {
  return { ...result, referenceRange: range, sourceFile: range.source.file, sourceExcerpt: range.source.excerpt };
}

function missingStatus(missing: Demographic[]): { status: RangeStatus; missing: Demographic[] } {
  return { status: "needs_demographics", missing };
}

/**
 * Deterministically classifies one raw result. Pipeline:
 * alias -> value validation -> unit normalisation -> urgent evaluation -> range lookup -> range status.
 */
export function classifyResult(raw: RawResult, demographics: Demographics): LabResult {
  let result = base(raw);

  const resolved = resolveTestName(raw.rawTestName);
  if (!resolved) return withStatus(result, "cannot_classify", "unknown_test");
  const canonical = resolved.canonical;
  result = { ...result, canonicalTestName: canonical, aliasSource: resolved.source };

  const ranges = REFERENCE_RANGES[canonical];
  const hasThreshold = URGENT_THRESHOLDS.some((t) => t.canonicalTestName === canonical);
  const first = ranges[0];
  if (!first && !hasThreshold) return withStatus(result, "cannot_classify", "no_range_for_test");
  if (first) result = { ...result, sourceFile: first.source.file };

  // ---- Qualitative tests (e.g. Urine Protein) ----
  if (first?.kind === "qualitative") {
    if (raw.rawUnit !== null) return withStatus(result, "cannot_classify", "unsupported_unit");
    result = { ...result, normalizedValue: raw.rawValue };
    const lookup = lookupRange(canonical, demographics.age, demographics.biologicalSex);
    if (lookup.status === "missing_demographics") {
      const { status, missing } = missingStatus(lookup.missing);
      return withStatus({ ...result, missingDemographics: missing }, status, "missing_demographics");
    }
    if (lookup.status !== "found" || lookup.range.kind !== "qualitative") {
      return withStatus(result, "cannot_classify", lookup.status === "no_range_for_test" ? "no_range_for_test" : "no_range_for_demographics");
    }
    result = withRange(result, lookup.range);
    const matches = raw.rawValue.trim().toLowerCase() === lookup.range.expected.toLowerCase();
    return matches ? withStatus(result, "normal", null) : withStatus(result, "cannot_classify", "qualitative_mismatch");
  }

  // ---- Numeric tests ----
  if (!PLAIN_NUMBER.test(raw.rawValue.trim())) return withStatus(result, "invalid", "invalid_value");
  const value = Number(raw.rawValue.trim());

  const referenceUnit =
    first?.kind === "numeric" ? first.unit : (URGENT_THRESHOLDS.find((t) => t.canonicalTestName === canonical)?.unit ?? null);
  const normalized = normalizeUnit(canonical, value, raw.rawUnit, referenceUnit);
  if (!normalized.ok) return withStatus(result, "cannot_classify", "unsupported_unit");
  result = { ...result, normalizedValue: normalized.value, normalizedUnit: normalized.unit, conversion: normalized.conversion };

  // Urgency never depends on demographics or on the range status.
  const urgent = evaluateUrgent(canonical, normalized.value, normalized.unit);

  const lookup = lookupRange(canonical, demographics.age, demographics.biologicalSex);
  switch (lookup.status) {
    case "no_range_for_test":
      return withStatus(result, "cannot_classify", "no_range_for_test", urgent);
    case "no_range_for_demographics":
      return withStatus(result, "cannot_classify", "no_range_for_demographics", urgent);
    case "missing_demographics": {
      const { status, missing } = missingStatus(lookup.missing);
      return withStatus({ ...result, missingDemographics: missing }, status, "missing_demographics", urgent);
    }
    case "found": {
      const range = lookup.range;
      if (range.kind !== "numeric") return withStatus(result, "cannot_classify", "no_range_for_test", urgent);
      result = withRange(result, range);
      // Inclusive boundaries: a value exactly on a limit is NORMAL.
      const status: RangeStatus = normalized.value < range.min ? "low" : normalized.value > range.max ? "high" : "normal";
      return withStatus(result, status, null, urgent);
    }
  }
}
