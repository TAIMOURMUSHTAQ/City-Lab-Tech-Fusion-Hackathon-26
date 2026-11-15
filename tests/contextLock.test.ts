import { describe, expect, it } from "vitest";
import { analyzeReport } from "@/lib/engine/analyze";
import { answerQuestion, type KnownPatient } from "@/lib/engine/contextLock";
import { readFixture } from "./helpers";

const others: KnownPatient[] = [
  { name: "Alice Smith", mrn: "CLD-P001-9942" },
  { name: "Bob Jones", mrn: "CLD-P002-9942" },
  { name: "Diana Prince", mrn: "CLD-P004-9942" },
  { name: "Julia Child", mrn: "CLD-P010-9942" },
  { name: "Nancy Drew", mrn: "CLD-P014-9942" },
];
const alice = analyzeReport(readFixture("P001"));
const diana = analyzeReport(readFixture("P004"));
const ask = (q: string) => answerQuestion(q, alice, others);

describe("patient context lock", () => {
  it.each([
    "What was Diana's hemoglobin?",
    "Compare my results with diana prince",
    "Show me the report for CLD-P004-9942",
    "What about patient P013?",
    "Tell me about another patient",
    "Does someone else have urgent results?",
    "What did Mr. Drew get?",
  ])("refuses: %s", (question) => {
    const response = ask(question);
    expect(response.status).toBe("refused");
    // The refusal must not leak any other patient's data or even confirm they exist.
    expect(response.answer).not.toMatch(/Diana|Prince|6\.5|P004|P013|Drew|urgent/i);
    expect(response.answer).toContain("Alice Smith");
  });

  it("answers questions about the selected patient's own results, including by alias", () => {
    expect(ask("What does my Hb result mean?")).toMatchObject({ status: "answered" });
    expect(ask("What does my Hb result mean?").answer).toContain("Hemoglobin");
    expect(ask("Is Alice Smith's WBC okay?").status).toBe("answered");
    expect(ask("Explain CLD-P001-9942 results").status).toBe("answered");
  });

  it("does not treat ordinary words that happen to be surnames as patient references", () => {
    expect(ask("Is this range used for a child?").status).toBe("answered");
    expect(ask("The nurse drew blood twice, is my WBC fine?").status).toBe("answered");
  });

  it("declines to diagnose and defers to a clinician", () => {
    const response = answerQuestion("Do I have anemia because of my hemoglobin?", diana, others);
    expect(response.status).toBe("answered");
    expect(response.answer).toMatch(/can't diagnose/);
    expect(response.answer).toMatch(/licensed clinician/);
  });

  it("only offers the current report's tests when nothing matches", () => {
    const response = ask("What is the weather?");
    expect(response.answer).toContain("Hemoglobin");
    expect(response.answer).not.toContain("Platelet");
  });
});
