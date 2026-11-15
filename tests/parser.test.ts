import { describe, expect, it } from "vitest";
import { ReportError } from "@/lib/domain/types";
import { parseReport, splitValueAndUnit } from "@/lib/engine/parser";
import { report } from "./helpers";

const resultsOf = (results: string) => parseReport(report({ age: "30", sex: "Female", results })).results;

describe("parser: result formats", () => {
  it("parses plain bullet lists", () => {
    expect(resultsOf("- Hemoglobin: 13.5 g/dL\n- WBC: 6000 cells/mcL")).toMatchObject([
      { rawTestName: "Hemoglobin", rawValue: "13.5", rawUnit: "g/dL", format: "bullet" },
      { rawTestName: "WBC", rawValue: "6000", rawUnit: "cells/mcL", format: "bullet" },
    ]);
  });

  it("parses bold bullet lists with either marker", () => {
    expect(resultsOf("* **FBS**: 85 mg/dL\n- **Serum Ferritin**: 25 ng/mL")).toMatchObject([
      { rawTestName: "FBS", rawValue: "85", rawUnit: "mg/dL" },
      { rawTestName: "Serum Ferritin", rawValue: "25", rawUnit: "ng/mL" },
    ]);
  });

  it("parses Markdown tables using header-named columns", () => {
    const table = "| Test | Value | Unit |\n| :--- | :--- | :--- |\n| ALT | 85 | U/L |\n| AST | 60 | U/L |";
    expect(resultsOf(table)).toMatchObject([
      { rawTestName: "ALT", rawValue: "85", rawUnit: "U/L", format: "table" },
      { rawTestName: "AST", rawValue: "60", rawUnit: "U/L", format: "table" },
    ]);
  });

  it("parses tables whose columns are in a different order", () => {
    const table = "| Unit | Result | Test Name |\n| --- | --- | --- |\n| U/L | 45 | SGPT |";
    expect(resultsOf(table)).toMatchObject([{ rawTestName: "SGPT", rawValue: "45", rawUnit: "U/L" }]);
  });

  it("parses `Test: value unit` lines", () => {
    expect(resultsOf("TSH: 2.5 mIU/L")).toMatchObject([
      { rawTestName: "TSH", rawValue: "2.5", rawUnit: "mIU/L", format: "key_value" },
    ]);
  });

  it("parses `Test Conducted / Value Recorded` and `Test / Result` pairs", () => {
    expect(resultsOf("Test Conducted: Fasting Blood Sugar\nValue Recorded: 110 mg/dL\nTest: AST\nResult: 44 U/L")).toMatchObject([
      { rawTestName: "Fasting Blood Sugar", rawValue: "110", rawUnit: "mg/dL", format: "paired_lines" },
      { rawTestName: "AST", rawValue: "44", rawUnit: "U/L", format: "paired_lines" },
    ]);
  });

  it("parses arrow notation, including unitless and qualitative values", () => {
    expect(resultsOf("* pH Level -> 5.5\n* Protein -> Negative")).toMatchObject([
      { rawTestName: "pH Level", rawValue: "5.5", rawUnit: null, format: "arrow" },
      { rawTestName: "Protein", rawValue: "Negative", rawUnit: null, format: "arrow" },
    ]);
  });

  it("ignores prose and everything outside the results section", () => {
    const results = resultsOf("The raw data output from the analyzers is presented below:\n\n- Hemoglobin: 13.5 g/dL");
    expect(results).toHaveLength(1); // the appendix "Value: 999 noise" line is excluded
  });

  it("splits values and units, keeping non-numeric values whole", () => {
    expect(splitValueAndUnit("6.0 mmol/L")).toEqual({ value: "6.0", unit: "mmol/L" });
    expect(splitValueAndUnit("[DATA CORRUPTED]")).toEqual({ value: "[DATA CORRUPTED]", unit: null });
  });
});

describe("parser: demographics", () => {
  it("extracts name, age, sex, MRN and issue date", () => {
    const md = report({ name: "Alice Smith", age: "28", sex: "Female", mrn: "CLD-P001-9942", results: "- Hb: 13 g/dL" }).replace(
      "## SECTION III",
      "* **Date of Issuance**: 2026-11-13\n## SECTION III",
    );
    expect(parseReport(md).demographics).toEqual({
      name: "Alice Smith",
      age: 28,
      biologicalSex: "Female",
      mrn: "CLD-P001-9942",
      issueDate: "2026-11-13",
    });
  });

  it("treats corrupted or absent age/sex as missing and warns, never guessing", () => {
    const parsed = parseReport(report({ age: "[DATA CORRUPTED]", sex: "[NOT PROVIDED]", results: "- Hb: 13 g/dL" }));
    expect(parsed.demographics.age).toBeNull();
    expect(parsed.demographics.biologicalSex).toBeNull();
    expect(parsed.warnings).toHaveLength(2);
  });
});

describe("parser: malformed input", () => {
  const codeOf = (fn: () => unknown): string | undefined => {
    try {
      fn();
    } catch (e) {
      return e instanceof ReportError ? e.code : "unexpected";
    }
    return undefined;
  };

  it("rejects a document without a results section", () => {
    expect(codeOf(() => parseReport("# Hello\n- Hemoglobin: 13 g/dL"))).toBe("no_results_section");
  });

  it("rejects a results section with no recognisable results", () => {
    expect(codeOf(() => parseReport("## Results\nNothing to see here."))).toBe("no_results_found");
  });

  it("warns about a test name with no value", () => {
    const parsed = parseReport(report({ results: "Test: AST\n- Hb: 13 g/dL" }));
    expect(parsed.warnings.some((w) => w.includes("AST"))).toBe(true);
  });
});
