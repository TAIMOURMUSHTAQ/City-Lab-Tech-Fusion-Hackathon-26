import { describe, expect, it } from "vitest";
import { ALIASES, PROJECT_SPEC_SOURCE, REFERENCE_RANGES, URGENT_THRESHOLDS } from "@/lib/knowledge/tables";
import type { SourceRef } from "@/lib/domain/types";
import { readSource } from "./helpers";

const sourceLines = (file: string): string[] =>
  readSource(file)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim());

/** Numbers appearing in an excerpt, e.g. "13.8 - 17.2 g/dL" -> [13.8, 17.2]. */
const numbersIn = (text: string): number[] => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

function expectTraceable(source: SourceRef): void {
  if (source.file === PROJECT_SPEC_SOURCE) return;
  expect(sourceLines(source.file), `${source.file}: ${source.excerpt}`).toContain(source.excerpt);
}

describe("knowledge tables are traceable to the supplied files", () => {
  it("every alias excerpt is a verbatim line of its source file and names the alias", () => {
    for (const a of ALIASES) {
      expectTraceable(a.source);
      expect(a.source.excerpt.toLowerCase()).toContain(a.canonical.toLowerCase());
    }
  });

  it("every reference range matches the numbers/expected value and ages of its verbatim source line", () => {
    for (const ranges of Object.values(REFERENCE_RANGES)) {
      for (const r of ranges) {
        expectTraceable(r.source);
        const nums = numbersIn(r.source.excerpt);
        expect(nums).toEqual(expect.arrayContaining([r.ageMin, r.ageMax]));
        if (r.kind === "numeric") expect(nums).toEqual(expect.arrayContaining([r.min, r.max]));
        else expect(r.source.excerpt).toContain(r.expected);
      }
    }
  });

  it("every urgent threshold matches the direction and value of its verbatim source line", () => {
    for (const t of URGENT_THRESHOLDS) {
      expectTraceable(t.source);
      expect(t.source.excerpt).toContain(t.direction === "less_than" ? "Less than" : "Greater than");
      expect(numbersIn(t.source.excerpt)).toContain(t.value);
      expect(t.source.excerpt).toContain(t.unit);
    }
  });
});
