import {
  type Analysis,
  type Demographic,
  type DemographicOverrides,
  type DemographicSource,
  type Patient,
  ReportError,
} from "@/lib/domain/types";
import { classifyResult } from "./classify";
import { deterministicExplanation, doctorQuestions } from "./facts";
import { parseReport } from "./parser";

function resolveDemographic<T>(
  fromReport: T | null,
  override: T | undefined,
  label: string,
): { value: T | null; source: DemographicSource } {
  if (fromReport !== null) {
    if (override !== undefined && override !== fromReport) {
      throw new ReportError(
        "demographic_conflict",
        `The report already records ${label} as "${String(fromReport)}". Supplied values may only fill missing information.`,
      );
    }
    return { value: fromReport, source: "report" };
  }
  if (override !== undefined) return { value: override, source: "user" };
  return { value: null, source: "missing" };
}

/**
 * Full deterministic pipeline: parse -> normalise -> classify -> urgent -> explanation facts.
 * No LLM is involved here.
 */
export function analyzeReport(markdown: string, overrides: DemographicOverrides = {}): Analysis {
  const parsed = parseReport(markdown);
  const demo = parsed.demographics;
  if (!demo.name) {
    throw new ReportError("missing_patient_name", "The report does not contain a patient name, so it cannot be locked to one patient.");
  }

  const age = resolveDemographic(demo.age, overrides.age, "age");
  const sex = resolveDemographic(demo.biologicalSex, overrides.biologicalSex, "biological sex");

  const patient: Patient = {
    id: demo.mrn ?? `uploaded:${demo.name}`,
    name: demo.name,
    age: age.value,
    biologicalSex: sex.value,
    mrn: demo.mrn,
    issueDate: demo.issueDate,
  };

  const results = parsed.results.map((raw) => {
    const result = classifyResult(raw, { age: patient.age, biologicalSex: patient.biologicalSex });
    return {
      ...result,
      explanation: deterministicExplanation(result),
      explanationSource: "deterministic" as const,
      doctorQuestions: doctorQuestions(result),
    };
  });

  const missingDemographics: Demographic[] = [];
  if (patient.age === null) missingDemographics.push("age");
  if (patient.biologicalSex === null) missingDemographics.push("biologicalSex");

  return {
    patient,
    demographicsSource: { age: age.source, biologicalSex: sex.source },
    missingDemographics,
    results,
    urgentCount: results.filter((r) => r.urgent).length,
    warnings: parsed.warnings,
  };
}
