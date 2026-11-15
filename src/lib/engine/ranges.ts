import type { BiologicalSex, Demographic, ReferenceRange } from "@/lib/domain/types";
import { REFERENCE_RANGES, type CanonicalTest } from "@/lib/knowledge/tables";

export type RangeLookup =
  | { status: "found"; range: ReferenceRange }
  | { status: "no_range_for_test" }
  | { status: "missing_demographics"; missing: Demographic[] }
  | { status: "no_range_for_demographics" };

/** Demographics a test's ranges depend on. Every supplied range is age-bounded; some are sex-specific. */
export function requiredDemographics(canonical: CanonicalTest): Demographic[] {
  const ranges = REFERENCE_RANGES[canonical];
  if (ranges.length === 0) return [];
  const required: Demographic[] = ["age"];
  if (ranges.some((r) => r.sex !== "All")) required.push("biologicalSex");
  return required;
}

/** Selects the single applicable range by canonical name, sex and age (age bounds inclusive). */
export function lookupRange(canonical: CanonicalTest, age: number | null, sex: BiologicalSex | null): RangeLookup {
  const ranges = REFERENCE_RANGES[canonical];
  if (ranges.length === 0) return { status: "no_range_for_test" };
  const missing = requiredDemographics(canonical).filter((d) => (d === "age" ? age === null : sex === null));
  if (missing.length > 0) return { status: "missing_demographics", missing };
  const range = ranges.find(
    (r) => (r.sex === "All" || r.sex === sex) && age !== null && age >= r.ageMin && age <= r.ageMax,
  );
  return range ? { status: "found", range } : { status: "no_range_for_demographics" };
}
