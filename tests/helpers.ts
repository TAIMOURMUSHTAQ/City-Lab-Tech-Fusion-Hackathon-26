import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RawResult } from "@/lib/domain/types";

export const REPORTS_DIR = path.resolve(__dirname, "..", "lab_reports");

export function readSource(file: string): string {
  return readFileSync(path.join(REPORTS_DIR, file), "utf8");
}

export function readFixture(id: string): string {
  const file = readdirSync(REPORTS_DIR).find((f) => f.startsWith(`report_${id}_`));
  if (!file) throw new Error(`fixture ${id} not found`);
  return readSource(file);
}

export function raw(rawTestName: string, rawValue: string, rawUnit: string | null): RawResult {
  return { rawTestName, rawValue, rawUnit, line: 1, format: "bullet" };
}

/** Builds a minimal CityLab-style report. */
export function report(opts: { name?: string | null; age?: string; sex?: string; mrn?: string; results: string }): string {
  const lines = ["# CITYLAB DIAGNOSTICS - TEST REPORT", "## SECTION I: PATIENT DEMOGRAPHICS"];
  if (opts.name !== null) lines.push(`* **Patient Full Name**: ${opts.name ?? "Test Person"}`);
  if (opts.age !== undefined) lines.push(`* **Recorded Age**: ${opts.age}`);
  if (opts.sex !== undefined) lines.push(`* **Biological Sex**: ${opts.sex}`);
  lines.push(`* **Medical Record Number (MRN)**: ${opts.mrn ?? "CLD-P900-0000"}`);
  lines.push("", "## SECTION III: ANALYTICAL RESULTS", opts.results, "", "### APPENDIX 1: NOISE", "Value: 999 noise");
  return lines.join("\r\n");
}
