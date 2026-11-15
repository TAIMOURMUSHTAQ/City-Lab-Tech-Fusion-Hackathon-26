/**
 * Structured knowledge derived ONLY from the supplied CityLab Markdown files.
 * Every entry carries a verbatim excerpt of the source line; tests/knowledge.test.ts
 * verifies each excerpt exists in the named file so this table cannot drift silently.
 */
import type { ReferenceRange, SourceRef, UnitConversion, UrgentThreshold } from "@/lib/domain/types";

export const GLOSSARY_FILE = "2_medical_glossary.md";
export const URGENT_FILE = "3_dangerous_urgent_values.md";
export const HEMATOLOGY_FILE = "4_ranges_hematology.md";
export const BIOCHEMISTRY_FILE = "5_ranges_biochemistry.md";
export const THYROID_URINE_FILE = "6_ranges_thyroid_urine.md";

const ref = (file: string, excerpt: string): SourceRef => ({ file, excerpt });

/** Canonical test names used throughout the engine. */
export const CANONICAL_TESTS = [
  "Hemoglobin",
  "White Blood Cell Count",
  "Platelet Count",
  "Red Blood Cell Count",
  "Fasting Blood Sugar",
  "ALT",
  "AST",
  "Cholesterol",
  "TSH",
  "Urine pH",
  "Urine Protein",
] as const;
export type CanonicalTest = (typeof CANONICAL_TESTS)[number];

export interface AliasEntry {
  alias: string;
  canonical: CanonicalTest;
  source: SourceRef;
}

export const ALIASES: readonly AliasEntry[] = [
  { alias: "SGPT", canonical: "ALT", source: ref(GLOSSARY_FILE, "* **SGPT** is the exact equivalent of **ALT** (Alanine Aminotransferase).") },
  { alias: "Alanine Aminotransferase", canonical: "ALT", source: ref(GLOSSARY_FILE, "* **SGPT** is the exact equivalent of **ALT** (Alanine Aminotransferase).") },
  { alias: "SGOT", canonical: "AST", source: ref(GLOSSARY_FILE, "* **SGOT** is the exact equivalent of **AST** (Aspartate Aminotransferase).") },
  { alias: "Aspartate Aminotransferase", canonical: "AST", source: ref(GLOSSARY_FILE, "* **SGOT** is the exact equivalent of **AST** (Aspartate Aminotransferase).") },
  { alias: "FBS", canonical: "Fasting Blood Sugar", source: ref(GLOSSARY_FILE, "* **FBS** is the exact equivalent of **Fasting Blood Sugar**.") },
  { alias: "Hb", canonical: "Hemoglobin", source: ref(GLOSSARY_FILE, "* **Hb** maps to **Hemoglobin**.") },
  { alias: "PLT", canonical: "Platelet Count", source: ref(GLOSSARY_FILE, "* **PLT** maps to **Platelet Count**.") },
  { alias: "RBC", canonical: "Red Blood Cell Count", source: ref(GLOSSARY_FILE, "* **RBC** maps to **Red Blood Cell Count**.") },
  { alias: "WBC", canonical: "White Blood Cell Count", source: ref(GLOSSARY_FILE, "* **WBC** maps to **White Blood Cell Count**.") },
  // Not in the glossary: the reference sheets contain exactly one pH range and one
  // protein range (both urinalysis), so these unqualified names have a single match.
  { alias: "pH Level", canonical: "Urine pH", source: ref(THYROID_URINE_FILE, "* **Urine pH**: 4.5 - 8.0 (Applicable to All sexes, 18-100 yrs).") },
  { alias: "pH", canonical: "Urine pH", source: ref(THYROID_URINE_FILE, "* **Urine pH**: 4.5 - 8.0 (Applicable to All sexes, 18-100 yrs).") },
  { alias: "Protein", canonical: "Urine Protein", source: ref(THYROID_URINE_FILE, "* **Urine Protein**: Negative (Applicable to All sexes, 18-100 yrs).") },
];

const HB_M = ref(HEMATOLOGY_FILE, "* Male Demographic (18-100 yrs): 13.8 - 17.2 g/dL");
const HB_F = ref(HEMATOLOGY_FILE, "* Female Demographic (18-100 yrs): 12.1 - 15.1 g/dL");
const WBC = ref(HEMATOLOGY_FILE, "* All Sexes (18-100 yrs): 4500 - 11000 cells/mcL");
const PLT = ref(HEMATOLOGY_FILE, "* All Sexes (18-100 yrs): 150000 - 450000 cells/mcL");

export const REFERENCE_RANGES: Readonly<Record<CanonicalTest, readonly ReferenceRange[]>> = {
  Hemoglobin: [
    { kind: "numeric", min: 13.8, max: 17.2, unit: "g/dL", sex: "Male", ageMin: 18, ageMax: 100, source: HB_M },
    { kind: "numeric", min: 12.1, max: 15.1, unit: "g/dL", sex: "Female", ageMin: 18, ageMax: 100, source: HB_F },
  ],
  "White Blood Cell Count": [
    { kind: "numeric", min: 4500, max: 11000, unit: "cells/mcL", sex: "All", ageMin: 18, ageMax: 100, source: WBC },
  ],
  "Platelet Count": [
    { kind: "numeric", min: 150000, max: 450000, unit: "cells/mcL", sex: "All", ageMin: 18, ageMax: 100, source: PLT },
  ],
  // RBC is named in the glossary but has no range in any reference sheet.
  "Red Blood Cell Count": [],
  "Fasting Blood Sugar": [
    { kind: "numeric", min: 70, max: 99, unit: "mg/dL", sex: "All", ageMin: 18, ageMax: 100, source: ref(BIOCHEMISTRY_FILE, "| **Fasting Blood Sugar** | All | 18 | 100 | 70 | 99 | mg/dL |") },
  ],
  ALT: [
    { kind: "numeric", min: 7, max: 55, unit: "U/L", sex: "Male", ageMin: 18, ageMax: 100, source: ref(BIOCHEMISTRY_FILE, "| **ALT** | Male | 18 | 100 | 7 | 55 | U/L |") },
    { kind: "numeric", min: 7, max: 45, unit: "U/L", sex: "Female", ageMin: 18, ageMax: 100, source: ref(BIOCHEMISTRY_FILE, "| **ALT** | Female | 18 | 100 | 7 | 45 | U/L |") },
  ],
  AST: [
    { kind: "numeric", min: 8, max: 48, unit: "U/L", sex: "Male", ageMin: 18, ageMax: 100, source: ref(BIOCHEMISTRY_FILE, "| **AST** | Male | 18 | 100 | 8 | 48 | U/L |") },
    { kind: "numeric", min: 8, max: 43, unit: "U/L", sex: "Female", ageMin: 18, ageMax: 100, source: ref(BIOCHEMISTRY_FILE, "| **AST** | Female | 18 | 100 | 8 | 43 | U/L |") },
  ],
  Cholesterol: [
    { kind: "numeric", min: 125, max: 200, unit: "mg/dL", sex: "All", ageMin: 18, ageMax: 100, source: ref(BIOCHEMISTRY_FILE, "| **Cholesterol** | All | 18 | 100 | 125 | 200 | mg/dL |") },
  ],
  TSH: [
    { kind: "numeric", min: 0.4, max: 4.0, unit: "mIU/L", sex: "All", ageMin: 18, ageMax: 100, source: ref(THYROID_URINE_FILE, "* **TSH**: 0.4 - 4.0 mIU/L (Applicable to All sexes, 18-100 yrs).") },
  ],
  "Urine pH": [
    { kind: "numeric", min: 4.5, max: 8.0, unit: null, sex: "All", ageMin: 18, ageMax: 100, source: ref(THYROID_URINE_FILE, "* **Urine pH**: 4.5 - 8.0 (Applicable to All sexes, 18-100 yrs).") },
  ],
  "Urine Protein": [
    { kind: "qualitative", expected: "Negative", sex: "All", ageMin: 18, ageMax: 100, source: ref(THYROID_URINE_FILE, "* **Urine Protein**: Negative (Applicable to All sexes, 18-100 yrs).") },
  ],
};

export const URGENT_THRESHOLDS: readonly UrgentThreshold[] = [
  { canonicalTestName: "Hemoglobin", direction: "less_than", value: 7.0, unit: "g/dL", source: ref(URGENT_FILE, "| **Hemoglobin** | Less than | 7.0 | g/dL |") },
  { canonicalTestName: "Fasting Blood Sugar", direction: "greater_than", value: 300, unit: "mg/dL", source: ref(URGENT_FILE, "| **Fasting Blood Sugar** | Greater than | 300 | mg/dL |") },
  { canonicalTestName: "Platelet Count", direction: "less_than", value: 50000, unit: "cells/mcL", source: ref(URGENT_FILE, "| **Platelet Count** | Less than | 50000 | cells/mcL |") },
  { canonicalTestName: "ALT", direction: "greater_than", value: 1000, unit: "U/L", source: ref(URGENT_FILE, "| **ALT** | Greater than | 1000 | U/L |") },
];

/**
 * The ONLY supported unit conversion. The reference files do not state a factor;
 * the factor is taken from the project acceptance specification
 * ("6.0 mmol/L must convert to approximately 108 mg/dL" => 108 / 6.0 = 18).
 */
export const PROJECT_SPEC_SOURCE = "Project acceptance specification";
export const UNIT_CONVERSIONS: readonly UnitConversion[] = [
  {
    canonicalTestName: "Fasting Blood Sugar",
    fromUnit: "mmol/L",
    toUnit: "mg/dL",
    factor: 18,
    source: ref(PROJECT_SPEC_SOURCE, "Glucose mmol/L to mg/dL: 6.0 mmol/L converts to approximately 108 mg/dL (factor 18)."),
  },
];
