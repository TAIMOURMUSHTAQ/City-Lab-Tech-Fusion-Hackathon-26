import { AskRequestSchema, type AskResponse } from "@/lib/domain/types";
import { analyzeReport } from "@/lib/engine/analyze";
import { answerQuestion } from "@/lib/engine/contextLock";
import { knownPatients } from "@/lib/server/fixtures";
import { handle, markdownFor, readBody } from "@/lib/server/http";

export const runtime = "nodejs";

/** Context-locked, deterministic Q&A about the selected report only. */
export async function POST(request: Request) {
  return handle(async (): Promise<AskResponse> => {
    const body = await readBody(request, AskRequestSchema);
    const analysis = analyzeReport(await markdownFor(body.source), body.demographics);
    return answerQuestion(body.question, analysis, await knownPatients());
  });
}
