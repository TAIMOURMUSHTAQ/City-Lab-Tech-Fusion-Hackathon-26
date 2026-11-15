import type { Demographic, LabResult, ReferenceRange } from "@/lib/domain/types";

/** Formats numbers consistently for display and explanation text (e.g. 150000 -> "150,000"). */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function formatValue(value: number | string | null, unit: string | null): string {
  if (value === null) return "—";
  const text = typeof value === "number" ? formatNumber(value) : value;
  return unit ? `${text} ${unit}` : text;
}

export function formatRange(range: ReferenceRange): string {
  if (range.kind === "qualitative") return range.expected;
  const unit = range.unit ? ` ${range.unit}` : "";
  return `${formatNumber(range.min)}–${formatNumber(range.max)}${unit}`;
}

export function rangeGroup(range: ReferenceRange): string {
  const who = range.sex === "All" ? "all sexes" : range.sex.toLowerCase() === "male" ? "males" : "females";
  return `${who}, ages ${range.ageMin}–${range.ageMax}`;
}

export const DEMOGRAPHIC_LABEL: Record<Demographic, string> = { age: "age", biologicalSex: "biological sex" };

export function joinDemographics(missing: readonly Demographic[]): string {
  return missing.map((d) => DEMOGRAPHIC_LABEL[d]).join(" and ");
}

const NOT_A_DIAGNOSIS =
  "A result outside the reference range is not a diagnosis; only a licensed clinician can interpret what it means for you.";

const testLabel = (r: LabResult): string => r.canonicalTestName ?? r.rawTestName;

function measured(r: LabResult): string {
  if (r.conversion && typeof r.normalizedValue === "number") {
    return `${formatValue(r.rawValue, r.rawUnit)} (≈ ${formatValue(r.normalizedValue, r.normalizedUnit)} after conversion)`;
  }
  if (typeof r.normalizedValue === "number") return formatValue(r.normalizedValue, r.normalizedUnit);
  return formatValue(r.rawValue, r.rawUnit);
}

/** Plain-language, non-diagnostic explanation built only from the deterministic result facts. */
export function deterministicExplanation(r: LabResult): string {
  const name = testLabel(r);
  const parts: string[] = [];
  const range = r.referenceRange;

  switch (r.rangeStatus) {
    case "normal":
      if (range?.kind === "qualitative") {
        parts.push(`Your ${name} result is "${r.rawValue}", which matches the expected CityLab result ("${range.expected}") for ${rangeGroup(range)}.`);
      } else if (range) {
        parts.push(`Your ${name} result of ${measured(r)} is within the CityLab reference range of ${formatRange(range)} for ${rangeGroup(range)}. Values exactly on a limit count as within range.`);
      }
      break;
    case "low":
    case "high":
      if (range) {
        const where = r.rangeStatus === "low" ? "below" : "above";
        parts.push(`Your ${name} result of ${measured(r)} is ${where} the CityLab reference range of ${formatRange(range)} for ${rangeGroup(range)}. ${NOT_A_DIAGNOSIS}`);
      }
      break;
    case "needs_demographics":
      parts.push(`The correct CityLab reference range for ${name} depends on ${joinDemographics(r.missingDemographics)}, which ${r.missingDemographics.length > 1 ? "are" : "is"} missing from this report. No classification has been made. Please provide the missing information.`);
      break;
    case "invalid":
      parts.push(`The recorded value "${r.rawValue}" for ${name} is not a valid number, so it cannot be compared with any range.`);
      break;
    case "cannot_classify":
      parts.push(cannotClassifyText(r));
      break;
  }

  if (r.urgent && r.urgentThreshold) {
    parts.push(`This value crosses a CityLab critical threshold: ${r.urgentReason} The lab directs that a doctor be seen today.`);
  }
  return parts.join(" ");
}

function cannotClassifyText(r: LabResult): string {
  const name = testLabel(r);
  switch (r.reason) {
    case "unknown_test":
      return `"${r.rawTestName}" is not listed in the supplied CityLab reference files, so this result cannot be classified from the files.`;
    case "no_range_for_test":
      return `The supplied CityLab reference files contain no reference range for ${name}, so this result cannot be classified from the files.`;
    case "unsupported_unit":
      return `The unit "${r.rawUnit ?? "(none)"}" is not the unit used by the CityLab reference range for ${name}, and the files document no conversion for it, so this result cannot be classified from the files.`;
    case "no_range_for_demographics":
      return `The supplied CityLab reference files have no ${name} range for this patient's age and biological sex, so this result cannot be classified from the files.`;
    case "qualitative_mismatch":
      return `The recorded ${name} result is "${r.rawValue}". The CityLab reference lists "${r.referenceRange?.kind === "qualitative" ? r.referenceRange.expected : ""}" as the expected result and does not describe how to grade other results, so this result cannot be classified from the files. Please discuss it with a clinician.`;
    default:
      return `This result cannot be classified from the files.`;
  }
}

/** Questions to bring to a clinician, derived only from deterministic result facts. */
export function doctorQuestions(r: LabResult): string[] {
  const name = testLabel(r);
  const questions: string[] = [];
  if (r.urgent) {
    questions.push(`My ${name} result of ${measured(r)} crossed the lab's critical threshold. What should I do today?`);
  }
  switch (r.rangeStatus) {
    case "low":
    case "high":
      if (r.referenceRange) {
        questions.push(`My ${name} was ${measured(r)}, which is ${r.rangeStatus === "low" ? "below" : "above"} the lab's reference range of ${formatRange(r.referenceRange)}. What could this mean for me?`);
        questions.push(`Should my ${name} be re-tested, and is any follow-up needed?`);
      }
      break;
    case "needs_demographics":
      questions.push(`Which reference range applies to my ${name} result, given my ${joinDemographics(r.missingDemographics)}?`);
      break;
    case "cannot_classify":
      questions.push(`The lab's reference files could not classify my ${name} result (${formatValue(r.rawValue, r.rawUnit)}). How should it be interpreted?`);
      break;
    case "invalid":
      questions.push(`My ${name} value was recorded as "${r.rawValue}". Does this test need to be repeated?`);
      break;
    case "normal":
      break;
  }
  return questions;
}
