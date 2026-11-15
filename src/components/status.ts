import type { Classification, RangeStatus } from "@/lib/domain/types";

/** Colour policy: red = urgent only, amber = abnormal non-urgent, green = normal only, slate = everything else. */
export const STATUS_STYLE: Record<Classification, { label: string; badge: string; border: string }> = {
  urgent: { label: "Urgent", badge: "bg-red-700 text-white", border: "border-red-600" },
  low: { label: "Low", badge: "bg-amber-100 text-amber-900 ring-1 ring-amber-400", border: "border-amber-400" },
  high: { label: "High", badge: "bg-amber-100 text-amber-900 ring-1 ring-amber-400", border: "border-amber-400" },
  normal: { label: "Normal", badge: "bg-green-100 text-green-900 ring-1 ring-green-500", border: "border-slate-200" },
  needs_demographics: { label: "Needs more information", badge: "bg-slate-100 text-slate-900 ring-1 ring-slate-500", border: "border-slate-400" },
  cannot_classify: { label: "Cannot be classified from the files", badge: "bg-slate-100 text-slate-900 ring-1 ring-slate-400", border: "border-slate-300" },
  invalid: { label: "Invalid value", badge: "bg-slate-100 text-slate-900 ring-1 ring-slate-400", border: "border-slate-300" },
};

export const rangeStatusLabel = (s: RangeStatus): string => STATUS_STYLE[s].label;
