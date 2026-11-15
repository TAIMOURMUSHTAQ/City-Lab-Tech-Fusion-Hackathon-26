import { describe, expect, it } from "vitest";
import { ReportError, type BiologicalSex } from "@/lib/domain/types";
import { resolveTestName } from "@/lib/engine/aliases";
import { analyzeReport } from "@/lib/engine/analyze";
import { classifyResult } from "@/lib/engine/classify";
import { raw, report } from "./helpers";

const adultF = { age: 30, biologicalSex: "Female" as BiologicalSex };
const adultM = { age: 30, biologicalSex: "Male" as BiologicalSex };
type Demo = { age: number | null; biologicalSex: BiologicalSex | null };
const classify = (name: string, value: string, unit: string | null, demo: Demo = adultF) => classifyResult(raw(name, value, unit), demo);

describe("alias normalisation", () => {
  it.each([
    ["SGPT", "ALT"],
    ["SGOT", "AST"],
    ["FBS", "Fasting Blood Sugar"],
    ["Hb", "Hemoglobin"],
    ["PLT", "Platelet Count"],
    ["RBC", "Red Blood Cell Count"],
    ["WBC", "White Blood Cell Count"],
  ])("%s maps to %s, citing the glossary", (alias, canonical) => {
    expect(resolveTestName(alias)).toMatchObject({ canonical, source: { file: "2_medical_glossary.md" } });
  });

  it("is case- and emphasis-insensitive", () => {
    expect(resolveTestName("**sgpt**")?.canonical).toBe("ALT");
  });

  it("returns null for tests not in the files", () => {
    expect(resolveTestName("Serum Ferritin")).toBeNull();
  });
});

describe("inclusive range boundaries", () => {
  it.each([
    ["Cholesterol", "125", "mg/dL", "normal"],
    ["Cholesterol", "200", "mg/dL", "normal"],
    ["Cholesterol", "124.9", "mg/dL", "low"],
    ["Cholesterol", "200.1", "mg/dL", "high"],
    ["WBC", "4500", "cells/mcL", "normal"],
    ["WBC", "11000", "cells/mcL", "normal"],
    ["TSH", "0.4", "mIU/L", "normal"],
    ["TSH", "4.0", "mIU/L", "normal"],
    ["pH", "8.0", null, "normal"],
    ["pH", "8.1", null, "high"],
  ])("%s %s %s is %s", (name, value, unit, expected) => {
    expect(classify(name, value, unit).classification).toBe(expected);
  });

  it("age boundaries are inclusive (18 and 100) and ages outside have no range", () => {
    expect(classify("TSH", "2", "mIU/L", { age: 18, biologicalSex: "Male" }).classification).toBe("normal");
    expect(classify("TSH", "2", "mIU/L", { age: 100, biologicalSex: "Male" }).classification).toBe("normal");
    expect(classify("TSH", "2", "mIU/L", { age: 17, biologicalSex: "Male" })).toMatchObject({
      classification: "cannot_classify",
      reason: "no_range_for_demographics",
    });
  });
});

describe("sex-specific ranges", () => {
  it("ALT 50 is normal for males (7–55) but high for females (7–45)", () => {
    expect(classify("ALT", "50", "U/L", adultM).classification).toBe("normal");
    expect(classify("ALT", "50", "U/L", adultF).classification).toBe("high");
  });

  it("Hemoglobin 13.5 is low for males (13.8–17.2) but normal for females (12.1–15.1)", () => {
    expect(classify("Hemoglobin", "13.5", "g/dL", adultM).classification).toBe("low");
    expect(classify("Hemoglobin", "13.5", "g/dL", adultF).classification).toBe("normal");
  });
});

describe("urgent thresholds (strict comparisons, independent of range status)", () => {
  it.each([
    ["Hemoglobin", "7.0", "g/dL", false],
    ["Hemoglobin", "6.9", "g/dL", true],
    ["Fasting Blood Sugar", "300", "mg/dL", false],
    ["Fasting Blood Sugar", "300.1", "mg/dL", true],
    ["Platelet Count", "50000", "cells/mcL", false],
    ["Platelet Count", "49999", "cells/mcL", true],
    ["ALT", "1000", "U/L", false],
    ["ALT", "1001", "U/L", true],
  ])("%s %s %s urgent=%s", (name, value, unit, urgent) => {
    expect(classify(name, value, unit).urgent).toBe(urgent);
  });

  it("an urgent value keeps its low/high range status alongside the urgent flag", () => {
    expect(classify("Platelet Count", "40000", "cells/mcL")).toMatchObject({
      classification: "urgent",
      rangeStatus: "low",
      urgent: true,
    });
    expect(classify("ALT", "1200", "U/L")).toMatchObject({ classification: "urgent", rangeStatus: "high" });
  });

  it("urgency is still reported when demographics are missing", () => {
    expect(classify("FBS", "350", "mg/dL", { age: null, biologicalSex: null })).toMatchObject({
      urgent: true,
      rangeStatus: "needs_demographics",
      referenceRange: null,
    });
  });

  it("urgency uses the converted value", () => {
    expect(classify("FBS", "17", "mmol/L").urgent).toBe(true); // 17 x 18 = 306 mg/dL
  });
});

describe("unit conversion", () => {
  it("converts glucose mmol/L to mg/dL and preserves the original value and unit", () => {
    expect(classify("Fasting Blood Sugar", "6.0", "mmol/L")).toMatchObject({
      rawValue: "6.0",
      rawUnit: "mmol/L",
      normalizedValue: 108,
      normalizedUnit: "mg/dL",
      conversion: { factor: 18 },
      classification: "high",
    });
  });

  it("accepts units case-insensitively without converting", () => {
    expect(classify("Cholesterol", "150", "MG/DL")).toMatchObject({ classification: "normal", conversion: null });
  });

  it.each([
    ["Cholesterol", "5", "mmol/L"],
    ["Hemoglobin", "135", "g/L"],
    ["WBC", "6", "x10^9/L"],
    ["TSH", "2", null],
    ["Protein", "Negative", "mg/dL"],
  ])("%s in %s is unsupported -> cannot_classify", (name, value, unit) => {
    expect(classify(name, value, unit)).toMatchObject({ classification: "cannot_classify", reason: "unsupported_unit" });
  });
});

describe("missing demographics", () => {
  const none: Demo = { age: null, biologicalSex: null };

  it("blocks classification when a required demographic is missing and lists it", () => {
    expect(classify("AST", "44", "U/L", { age: 32, biologicalSex: null })).toMatchObject({
      classification: "needs_demographics",
      missingDemographics: ["biologicalSex"],
      referenceRange: null,
    });
    expect(classify("Cholesterol", "150", "mg/dL", none)).toMatchObject({ missingDemographics: ["age"] });
  });

  it("does not require sex for tests whose range applies to all sexes", () => {
    expect(classify("WBC", "6000", "cells/mcL", { age: 40, biologicalSex: null }).classification).toBe("normal");
  });

  it("supplied values fill gaps but may not override the report", () => {
    const md = report({ age: "32", sex: "[NOT PROVIDED]", results: "Test: AST\nResult: 44 U/L" });
    expect(analyzeReport(md, { biologicalSex: "Female" }).results[0]?.classification).toBe("high");
    expect(analyzeReport(md, { biologicalSex: "Male" }).results[0]?.classification).toBe("normal");
    expect(() => analyzeReport(md, { age: 50 })).toThrow(ReportError);
  });
});

describe("unsupported tests and invalid values", () => {
  it("unknown tests are cannot_classify with no range and no source", () => {
    expect(classify("Serum Ferritin", "25", "ng/mL")).toMatchObject({
      classification: "cannot_classify",
      reason: "unknown_test",
      referenceRange: null,
      sourceFile: null,
    });
  });

  it("known tests with no range in the files are cannot_classify", () => {
    expect(classify("RBC", "4.5", "million/mcL")).toMatchObject({ classification: "cannot_classify", reason: "no_range_for_test" });
  });

  it("non-numeric values for numeric tests are invalid", () => {
    expect(classify("Hemoglobin", "[DATA CORRUPTED]", null).classification).toBe("invalid");
    expect(classify("PLT", "150,000", "cells/mcL").classification).toBe("invalid");
  });

  it("qualitative results other than the documented value are not guessed", () => {
    expect(classify("Urine Protein", "Positive", null)).toMatchObject({
      classification: "cannot_classify",
      reason: "qualitative_mismatch",
    });
  });
});

describe("report-level analysis", () => {
  it("classifies multiple results in one report independently", () => {
    const md = report({ age: "40", sex: "Male", results: "* **WBC**: 12000 cells/mcL\n* **PLT**: 40000 cells/mcL\n* **Ferritin**: 3 ng/mL" });
    const a = analyzeReport(md);
    expect(a.results.map((r) => r.classification)).toEqual(["high", "urgent", "cannot_classify"]);
    expect(a.urgentCount).toBe(1);
  });

  it("rejects a report with no patient name", () => {
    expect(() => analyzeReport(report({ name: null, results: "- Hb: 13 g/dL" }))).toThrow(/patient name/);
  });

  it("explanations never claim a disease and always defer to a clinician when abnormal", () => {
    const md = report({ age: "40", sex: "Male", results: "- FBS: 350 mg/dL\n- ALT: 85 U/L" });
    for (const r of analyzeReport(md).results) {
      expect(r.explanation).not.toMatch(/you have|diabetes|disease/i);
      expect(r.explanation).toMatch(/only a licensed clinician/i);
      expect(r.doctorQuestions.length).toBeGreaterThan(0);
    }
  });
});
