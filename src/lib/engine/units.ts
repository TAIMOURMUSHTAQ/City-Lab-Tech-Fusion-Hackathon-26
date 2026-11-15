import type { UnitConversion } from "@/lib/domain/types";
import { UNIT_CONVERSIONS } from "@/lib/knowledge/tables";

export type UnitNormalization =
  | { ok: true; value: number; unit: string | null; conversion: UnitConversion | null }
  | { ok: false };

const sameUnit = (a: string | null, b: string | null): boolean =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/** Avoids floating-point artefacts such as 108.00000000000001. */
const round = (value: number): number => Math.round(value * 10_000) / 10_000;

/**
 * Expresses a numeric value in the reference unit. Units are compared case-insensitively
 * (no other equivalences). Only conversions listed in UNIT_CONVERSIONS are applied.
 */
export function normalizeUnit(
  canonicalTestName: string,
  value: number,
  rawUnit: string | null,
  referenceUnit: string | null,
): UnitNormalization {
  if (sameUnit(rawUnit, referenceUnit)) {
    return { ok: true, value, unit: referenceUnit, conversion: null };
  }
  const conversion = UNIT_CONVERSIONS.find(
    (c) => c.canonicalTestName === canonicalTestName && sameUnit(c.fromUnit, rawUnit) && sameUnit(c.toUnit, referenceUnit),
  );
  if (!conversion) return { ok: false };
  return { ok: true, value: round(value * conversion.factor), unit: conversion.toUnit, conversion };
}
