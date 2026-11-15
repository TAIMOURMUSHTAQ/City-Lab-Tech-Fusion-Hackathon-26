import { describe, expect, it } from "vitest";
import type { Analysis } from "@/lib/domain/types";
import { analyzeReport } from "@/lib/engine/analyze";
import { readFixture } from "./helpers";

const analyze = (id: string): Analysis => analyzeReport(readFixture(id));
const result = (a: Analysis, canonical: string) => {
  const r = a.results.find((x) => x.canonicalTestName === canonical);
  if (!r) throw new Error(`${canonical} not found`);
  return r;
};

describe("acceptance: supplied fixture reports", () => {
  it("P001 Alice: Hemoglobin 13.5 g/dL is classified against the female range; WBC 6000 is normal", () => {
    const a = analyze("P001");
    expect(a.patient).toMatchObject({ name: "Alice Smith", age: 28, biologicalSex: "Female", mrn: "CLD-P001-9942", issueDate: "2026-11-13" });
    // The supplied female range is 12.1–15.1 g/dL, so 13.5 is inside it (NORMAL).
    // The project brief lists this case as "low"; that contradicts 4_ranges_hematology.md,
    // which is the source of truth for ranges. See README "Known limitations".
    expect(result(a, "Hemoglobin")).toMatchObject({
      classification: "normal",
      referenceRange: { sex: "Female", min: 12.1, max: 15.1 },
      sourceFile: "4_ranges_hematology.md",
    });
    expect(result(a, "White Blood Cell Count").classification).toBe("normal");
  });

  it("P002 Bob: SGPT becomes ALT and 45 U/L is normal on the female upper boundary", () => {
    const a = analyze("P002");
    expect(a.patient.biologicalSex).toBe("Female"); // as recorded; never inferred from the name
    expect(result(a, "ALT")).toMatchObject({ rawTestName: "SGPT", classification: "normal", referenceRange: { sex: "Female", max: 45 } });
  });

  it("P003 Charlie: missing age and sex -> Fasting Blood Sugar needs demographics, nothing guessed", () => {
    const a = analyze("P003");
    expect(a.patient.age).toBeNull();
    expect(a.patient.biologicalSex).toBeNull();
    expect(a.missingDemographics).toEqual(["age", "biologicalSex"]);
    expect(result(a, "Fasting Blood Sugar")).toMatchObject({ classification: "needs_demographics", referenceRange: null, urgent: false });
  });

  it("P004 Diana: Hemoglobin 6.5 g/dL is urgent (and low); Platelets 120000 low but not urgent", () => {
    const a = analyze("P004");
    expect(result(a, "Hemoglobin")).toMatchObject({ classification: "urgent", rangeStatus: "low", urgent: true });
    expect(result(a, "Platelet Count")).toMatchObject({ classification: "low", urgent: false });
    expect(a.urgentCount).toBe(1);
  });

  it("P005 Ethan: 6.0 mmol/L converts to 108 mg/dL, preserving the original", () => {
    expect(result(analyze("P005"), "Fasting Blood Sugar")).toMatchObject({
      rawValue: "6.0",
      rawUnit: "mmol/L",
      normalizedValue: 108,
      normalizedUnit: "mg/dL",
      classification: "high",
    });
  });

  it("P006 Fiona: Serum Ferritin cannot be classified", () => {
    const a = analyze("P006");
    expect(a.results).toHaveLength(1);
    expect(a.results[0]).toMatchObject({ rawTestName: "Serum Ferritin", classification: "cannot_classify", referenceRange: null });
    expect(a.results[0]?.explanation).toContain("cannot be classified from the files");
  });

  it("P007 George: TSH 2.5 mIU/L is normal", () => {
    expect(result(analyze("P007"), "TSH").classification).toBe("normal");
  });

  it("P008 Haley: urine pH 5.5 and urine protein Negative are normal", () => {
    const a = analyze("P008");
    expect(result(a, "Urine pH").classification).toBe("normal");
    expect(result(a, "Urine Protein").classification).toBe("normal");
  });

  it("P009 Ian: ALT 85 and AST 60 are high and neither is urgent", () => {
    const a = analyze("P009");
    expect(result(a, "ALT")).toMatchObject({ classification: "high", urgent: false });
    expect(result(a, "AST")).toMatchObject({ classification: "high", urgent: false });
  });

  it("P010 Julia: Cholesterol exactly 200 mg/dL is normal", () => {
    expect(result(analyze("P010"), "Cholesterol").classification).toBe("normal");
  });

  it("P011 Kevin: WBC 12000 is high and PLT 140000 is low", () => {
    const a = analyze("P011");
    expect(result(a, "White Blood Cell Count").classification).toBe("high");
    expect(result(a, "Platelet Count")).toMatchObject({ rawTestName: "PLT", classification: "low", urgent: false });
  });

  it("P012 Laura: AST needs biological sex before it can be classified", () => {
    const a = analyze("P012");
    expect(a.missingDemographics).toEqual(["biologicalSex"]);
    expect(result(a, "AST")).toMatchObject({ classification: "needs_demographics", missingDemographics: ["biologicalSex"] });
  });

  it("P013 Michael: Fasting Blood Sugar 350 mg/dL is urgent", () => {
    expect(result(analyze("P013"), "Fasting Blood Sugar")).toMatchObject({ classification: "urgent", rangeStatus: "high", urgent: true });
  });

  it("P014 Nancy: FBS and SGOT map and are normal", () => {
    const a = analyze("P014");
    expect(result(a, "Fasting Blood Sugar")).toMatchObject({ rawTestName: "FBS", classification: "normal" });
    expect(result(a, "AST")).toMatchObject({ rawTestName: "SGOT", classification: "normal" });
  });
});
