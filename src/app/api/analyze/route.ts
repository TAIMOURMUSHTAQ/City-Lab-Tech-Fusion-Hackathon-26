import { AnalyzeRequestSchema, type Analysis } from "@/lib/domain/types";
import { analyzeReport } from "@/lib/engine/analyze";
import { handle, markdownFor, readBody } from "@/lib/server/http";
import { rephraseExplanations } from "@/lib/server/llm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async (): Promise<Analysis> => {
    const body = await readBody(request, AnalyzeRequestSchema);
    const analysis = analyzeReport(await markdownFor(body.source), body.demographics);
    return { ...analysis, results: await rephraseExplanations(analysis.results) };
  });
}
