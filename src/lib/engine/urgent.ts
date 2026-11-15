import type { UrgentThreshold } from "@/lib/domain/types";
import { URGENT_THRESHOLDS } from "@/lib/knowledge/tables";

export interface UrgentEvaluation {
  urgent: boolean;
  threshold: UrgentThreshold | null;
  reason: string | null;
}

const NOT_URGENT: UrgentEvaluation = { urgent: false, threshold: null, reason: null };

/**
 * Evaluated independently of the reference-range status and of demographics.
 * Comparisons are strict, exactly as written in 3_dangerous_urgent_values.md.
 */
export function evaluateUrgent(canonicalTestName: string, value: number, unit: string | null): UrgentEvaluation {
  const threshold = URGENT_THRESHOLDS.find(
    (t) => t.canonicalTestName === canonicalTestName && t.unit.toLowerCase() === (unit ?? "").toLowerCase(),
  );
  if (!threshold) return NOT_URGENT;
  const crossed = threshold.direction === "less_than" ? value < threshold.value : value > threshold.value;
  if (!crossed) return { urgent: false, threshold, reason: null };
  const phrase = threshold.direction === "less_than" ? "less than" : "greater than";
  return {
    urgent: true,
    threshold,
    reason: `${value} ${threshold.unit} is ${phrase} the CityLab critical threshold of ${threshold.value} ${threshold.unit}.`,
  };
}
