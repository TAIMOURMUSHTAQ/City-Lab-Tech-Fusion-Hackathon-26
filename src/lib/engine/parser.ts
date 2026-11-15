import { type BiologicalSex, type RawResult, ReportError } from "@/lib/domain/types";

export interface ParsedDemographics {
  name: string | null;
  age: number | null;
  biologicalSex: BiologicalSex | null;
  mrn: string | null;
  issueDate: string | null;
}

export interface ParsedReport {
  demographics: ParsedDemographics;
  results: RawResult[];
  warnings: string[];
}

type DemoField = keyof ParsedDemographics;

const DEMOGRAPHIC_LABELS: Readonly<Record<string, DemoField>> = {
  "patient full name": "name",
  "patient name": "name",
  "full name": "name",
  name: "name",
  "recorded age": "age",
  age: "age",
  "biological sex": "biologicalSex",
  sex: "biologicalSex",
  "medical record number (mrn)": "mrn",
  "medical record number": "mrn",
  mrn: "mrn",
  "date of issuance": "issueDate",
  "issue date": "issueDate",
  "date issued": "issueDate",
};

const TEST_KEYS = new Set(["test", "test conducted", "test name"]);
const VALUE_KEYS = new Set(["value recorded", "result", "value"]);

const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const RESULTS_HEADING = /\bresults?\b/i;
const LABELLED_BULLET = /^\s*[-*]\s+(?:\*\*)?([^*:]+?)(?:\*\*)?\s*:\s*(.*)$/;
const ARROW_LINE = /^\s*(?:[-*]\s+)?(.+?)\s*->\s*(.+?)\s*$/;
const KEY_VALUE_LINE = /^\s*([-*]\s+)?(?:\*\*)?([^*:|]+?)(?:\*\*)?\s*:\s*(.+?)\s*$/;
const TABLE_SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const LEADING_NUMBER = /^([+-]?\d[\d.,]*)\s*(.*)$/;

/** Removes Markdown bold/italic markers and surrounding whitespace. */
export function stripEmphasis(text: string): string {
  return text.replace(/\*\*|__/g, "").replace(/^\*|\*$/g, "").trim();
}

/** Splits "13.5 g/dL" into value and unit. Non-numeric text (e.g. "Negative") is kept whole as the value. */
export function splitValueAndUnit(text: string): { value: string; unit: string | null } {
  const cleaned = stripEmphasis(text);
  const match = LEADING_NUMBER.exec(cleaned);
  if (match) {
    const unit = (match[2] ?? "").trim();
    return { value: match[1] ?? "", unit: unit === "" ? null : unit };
  }
  return { value: cleaned, unit: null };
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => stripEmphasis(cell));
}

function parseAge(raw: string, warnings: string[]): number | null {
  const value = stripEmphasis(raw);
  if (/^\d{1,3}$/.test(value)) {
    const age = Number(value);
    if (age <= 130) return age;
  }
  warnings.push(`Age "${value}" is not a usable age; it is treated as missing.`);
  return null;
}

function parseSex(raw: string, warnings: string[]): BiologicalSex | null {
  const value = stripEmphasis(raw).toLowerCase();
  if (value === "male") return "Male";
  if (value === "female") return "Female";
  warnings.push(`Biological sex "${stripEmphasis(raw)}" is not "Male" or "Female"; it is treated as missing.`);
  return null;
}

function findResultsSection(lines: readonly string[]): { start: number; end: number } {
  const start = lines.findIndex((line) => {
    const heading = HEADING.exec(line);
    return heading !== null && RESULTS_HEADING.test(heading[1] ?? "");
  });
  if (start === -1) {
    throw new ReportError(
      "no_results_section",
      'No results section was found. The report needs a Markdown heading containing "Results" (e.g. "## SECTION III: ANALYTICAL RESULTS").',
    );
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (HEADING.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return { start: start + 1, end };
}

function parseDemographics(lines: readonly string[], skip: { start: number; end: number }, warnings: string[]): ParsedDemographics {
  const demo: ParsedDemographics = { name: null, age: null, biologicalSex: null, mrn: null, issueDate: null };
  const seen = new Set<DemoField>();
  lines.forEach((line, index) => {
    if (index >= skip.start && index < skip.end) return;
    const match = LABELLED_BULLET.exec(line);
    if (!match) return;
    const field = DEMOGRAPHIC_LABELS[(match[1] ?? "").trim().toLowerCase()];
    if (!field || seen.has(field)) return;
    seen.add(field);
    const raw = (match[2] ?? "").trim();
    if (raw === "") return;
    switch (field) {
      case "age":
        demo.age = parseAge(raw, warnings);
        break;
      case "biologicalSex":
        demo.biologicalSex = parseSex(raw, warnings);
        break;
      default:
        demo[field] = stripEmphasis(raw);
    }
  });
  return demo;
}

function parseTable(
  rows: readonly { text: string; line: number }[],
  results: RawResult[],
  warnings: string[],
): void {
  const [header, ...body] = rows;
  if (!header) return;
  const columns = splitTableRow(header.text).map((c) => c.toLowerCase());
  const testIdx = columns.findIndex((c) => /test|analyte|name/.test(c));
  const valueIdx = columns.findIndex((c) => /result|value/.test(c));
  const unitIdx = columns.findIndex((c) => /unit/.test(c));
  if (testIdx === -1 || valueIdx === -1) {
    warnings.push(`Table at line ${header.line} has no recognisable test/value columns and was skipped.`);
    return;
  }
  for (const row of body) {
    if (TABLE_SEPARATOR.test(row.text.trim())) continue;
    const cells = splitTableRow(row.text);
    const name = cells[testIdx] ?? "";
    const rawValue = cells[valueIdx] ?? "";
    if (name === "" || rawValue === "") {
      warnings.push(`Table row at line ${row.line} is incomplete and was skipped.`);
      continue;
    }
    let unit = unitIdx === -1 ? null : (cells[unitIdx] ?? "").trim() || null;
    let value = rawValue;
    if (unitIdx === -1) {
      const split = splitValueAndUnit(rawValue);
      value = split.value;
      unit = split.unit;
    }
    results.push({ rawTestName: name, rawValue: value, rawUnit: unit, line: row.line, format: "table" });
  }
}

/**
 * Deterministically extracts demographics and analytical results from a CityLab Markdown report.
 * Throws ReportError when the document is structurally unusable.
 */
export function parseReport(markdown: string): ParsedReport {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const warnings: string[] = [];
  const section = findResultsSection(lines);
  const demographics = parseDemographics(lines, section, warnings);
  const results: RawResult[] = [];

  let pendingTest: { name: string; line: number } | null = null;
  let tableRows: { text: string; line: number }[] = [];
  const flushTable = () => {
    if (tableRows.length > 0) parseTable(tableRows, results, warnings);
    tableRows = [];
  };

  for (let i = section.start; i < section.end; i++) {
    const text = lines[i] ?? "";
    const lineNo = i + 1;
    if (text.trim().startsWith("|")) {
      tableRows.push({ text, line: lineNo });
      continue;
    }
    flushTable();
    if (text.trim() === "") continue;

    const arrow = ARROW_LINE.exec(text);
    if (arrow) {
      const { value, unit } = splitValueAndUnit(arrow[2] ?? "");
      results.push({ rawTestName: stripEmphasis(arrow[1] ?? ""), rawValue: value, rawUnit: unit, line: lineNo, format: "arrow" });
      continue;
    }

    const kv = KEY_VALUE_LINE.exec(text);
    if (kv) {
      const key = stripEmphasis(kv[2] ?? "");
      const rawValue = kv[3] ?? "";
      const keyLower = key.toLowerCase();
      if (TEST_KEYS.has(keyLower)) {
        if (pendingTest) warnings.push(`Test "${pendingTest.name}" at line ${pendingTest.line} has no recorded value.`);
        pendingTest = { name: stripEmphasis(rawValue), line: lineNo };
        continue;
      }
      if (VALUE_KEYS.has(keyLower)) {
        if (!pendingTest) {
          warnings.push(`Value at line ${lineNo} is not preceded by a test name and was ignored.`);
          continue;
        }
        const { value, unit } = splitValueAndUnit(rawValue);
        results.push({ rawTestName: pendingTest.name, rawValue: value, rawUnit: unit, line: pendingTest.line, format: "paired_lines" });
        pendingTest = null;
        continue;
      }
      // Guard against prose sentences that happen to contain a colon.
      if (key.split(/\s+/).length <= 6) {
        const { value, unit } = splitValueAndUnit(rawValue);
        results.push({ rawTestName: key, rawValue: value, rawUnit: unit, line: lineNo, format: kv[1] ? "bullet" : "key_value" });
        continue;
      }
    }

    if (/\d/.test(text)) warnings.push(`Line ${lineNo} in the results section was not recognised and was ignored.`);
  }
  flushTable();
  if (pendingTest) warnings.push(`Test "${pendingTest.name}" at line ${pendingTest.line} has no recorded value.`);

  if (results.length === 0) {
    throw new ReportError("no_results_found", "The results section contains no recognisable test results.");
  }
  return { demographics, results, warnings };
}
