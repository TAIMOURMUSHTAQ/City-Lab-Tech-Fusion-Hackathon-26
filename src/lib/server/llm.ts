import "server-only";
import { z } from "zod";
import type { ExplainedResult } from "@/lib/domain/types";
import { formatRange, formatValue } from "@/lib/engine/facts";
import { llmConfig, verifyRephrase } from "@/lib/llm/guard";

/**
 * OPTIONAL rephrasing adapter for an OpenAI-compatible chat-completions endpoint (e.g. Groq, OpenRouter).
 * - Disabled unless LLM_API_BASE_URL, LLM_API_KEY and LLM_MODEL are all set.
 * - Receives only de-identified, already-verified facts (no name, MRN, age, sex or date).
 * - Can only replace explanation prose; every structured field stays deterministic.
 * - Any failure or unverifiable output falls back to the deterministic text.
 */

const OutputSchema = z.object({
  explanations: z.array(z.object({ index: z.number().int().nonnegative(), text: z.string().min(1).max(700) })),
});

const ChatResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

type Rephrasable = ExplainedResult & { rangeStatus: "normal" | "low" | "high" };
const isRephrasable = (r: ExplainedResult): r is Rephrasable =>
  (r.rangeStatus === "normal" || r.rangeStatus === "low" || r.rangeStatus === "high") && r.referenceRange !== null;

function factsFor(r: Rephrasable, index: number) {
  return {
    index,
    test: r.canonicalTestName,
    recorded: formatValue(r.rawValue, r.rawUnit),
    comparedValue: formatValue(r.normalizedValue, r.normalizedUnit),
    referenceRange: r.referenceRange ? formatRange(r.referenceRange) : null,
    status: r.rangeStatus,
    urgent: r.urgent,
    urgentReason: r.urgentReason,
  };
}

export async function rephraseExplanations(results: ExplainedResult[]): Promise<ExplainedResult[]> {
  const config = llmConfig();
  if (!config) return results;
  const candidates = results.map((r, i) => (isRephrasable(r) ? factsFor(r, i) : null)).filter((f) => f !== null);
  if (candidates.length === 0) return results;

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You rewrite verified lab-result facts as short, calm, plain-language sentences for a patient. " +
              "Use ONLY the facts given. Do not add numbers, causes, conditions, diseases, diagnoses or advice beyond the facts. " +
              "For status low/high or urgent, include the sentence: 'Only a licensed clinician can interpret what it means for you.' " +
              "For urgent results, say the lab directs that a doctor be seen today. " +
              'Respond with JSON: {"explanations":[{"index":number,"text":string}]}.',
          },
          { role: "user", content: JSON.stringify({ facts: candidates }) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
    const chat = ChatResponseSchema.parse(await response.json());
    const output = OutputSchema.parse(JSON.parse(chat.choices[0]?.message.content ?? ""));

    return results.map((r, i) => {
      const item = output.explanations.find((e) => e.index === i);
      const fact = candidates.find((c) => c.index === i);
      if (!item || !fact) return r;
      const allowedText = `${JSON.stringify(fact)} ${r.explanation}`;
      return verifyRephrase(item.text, r, allowedText) ? { ...r, explanation: item.text, explanationSource: "llm" as const } : r;
    });
  } catch (error) {
    console.warn("LLM rephrasing unavailable; using deterministic explanations.", error instanceof Error ? error.message : error);
    return results;
  }
}
