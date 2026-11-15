"use client";

import { Ban, Loader2, MessageSquare } from "lucide-react";
import { useId, useState } from "react";
import type { AskResponse, DemographicOverrides, ReportSource } from "@/lib/domain/types";
import { ApiRequestError, postJson } from "@/lib/client/api";

interface Exchange {
  question: string;
  response: AskResponse;
}

interface Props {
  patientName: string;
  source: ReportSource;
  demographics: DemographicOverrides;
}

/** Narrow, context-locked questions about the selected report. Answers are deterministic. */
export function AskPanel({ patientName, source, demographics }: Props) {
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setPending(true);
    setError(null);
    try {
      const response = await postJson<AskResponse>("/api/ask", { source, demographics, question: q });
      setHistory((h) => [...h, { question: q, response }]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "The question could not be answered.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="ask-heading" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="ask-heading" className="flex items-center gap-2 text-lg font-semibold">
        <MessageSquare className="size-5" aria-hidden="true" /> Ask about {patientName}&apos;s results
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Answers come only from this report and the CityLab reference files. Questions about any other patient are refused.
      </p>

      <ol className="mt-4 space-y-3" aria-live="polite">
        {history.map((x, i) => (
          <li key={i} className="space-y-1">
            <p className="text-sm font-medium">You: {x.question}</p>
            <div
              className={`whitespace-pre-line rounded-md p-3 text-sm ${
                x.response.status === "refused" ? "border border-slate-500 bg-slate-100 text-slate-900" : "bg-slate-50 text-slate-800"
              }`}
            >
              {x.response.status === "refused" && (
                <span className="mb-1 flex items-center gap-1 font-semibold">
                  <Ban className="size-4" aria-hidden="true" /> Refused: outside this session
                </span>
              )}
              {x.response.answer}
            </div>
          </li>
        ))}
      </ol>

      <form onSubmit={(e) => void ask(e)} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={inputId} className="block text-sm font-medium">
            Your question
          </label>
          <input
            id={inputId}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="e.g. What does my hemoglobin result mean?"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Ask
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium">
          {error}
        </p>
      )}
    </section>
  );
}
