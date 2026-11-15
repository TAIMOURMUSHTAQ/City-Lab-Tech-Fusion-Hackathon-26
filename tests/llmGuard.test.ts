import { describe, expect, it } from "vitest";
import { analyzeReport } from "@/lib/engine/analyze";
import { llmConfig, verifyRephrase } from "@/lib/llm/guard";
import { report } from "./helpers";

const [high, urgent] = analyzeReport(report({ age: "40", sex: "Male", results: "- ALT: 85 U/L\n- FBS: 350 mg/dL" })).results;
if (!high || !urgent) throw new Error("fixture setup failed");

describe("optional LLM adapter guard", () => {
  it("is disabled unless all three variables are set, and refuses plaintext endpoints", () => {
    expect(llmConfig({})).toBeNull();
    expect(llmConfig({ LLM_API_BASE_URL: "https://api.example.com/v1", LLM_API_KEY: "k" })).toBeNull();
    expect(llmConfig({ LLM_API_BASE_URL: "http://api.example.com/v1", LLM_API_KEY: "k", LLM_MODEL: "m" })).toBeNull();
    expect(llmConfig({ LLM_API_BASE_URL: "https://api.example.com/v1/", LLM_API_KEY: "k", LLM_MODEL: "m" })).toMatchObject({
      baseUrl: "https://api.example.com/v1",
    });
  });

  const ok = "Your ALT of 85 U/L is above the lab range of 7–55 U/L. Only a licensed clinician can interpret what it means for you.";

  it("accepts prose that only restates verified facts with the safety sentence", () => {
    expect(verifyRephrase(ok, high, high.explanation)).toBe(true);
  });

  it("rejects invented numbers, diagnostic claims and missing safety wording", () => {
    expect(verifyRephrase(ok.replace("7–55", "7–40"), high, high.explanation)).toBe(false);
    expect(verifyRephrase(`${ok} You have liver disease.`, high, high.explanation)).toBe(false);
    expect(verifyRephrase("Your ALT of 85 U/L is above the range.", high, high.explanation)).toBe(false);
  });

  it("requires urgent results to keep the see-a-doctor direction", () => {
    const text = "Your sugar of 350 mg/dL is above 300 mg/dL. Only a licensed clinician can interpret what it means for you.";
    expect(verifyRephrase(text, urgent, urgent.explanation)).toBe(false);
    expect(verifyRephrase(`${text} Please see a doctor today.`, urgent, urgent.explanation)).toBe(true);
  });
});
