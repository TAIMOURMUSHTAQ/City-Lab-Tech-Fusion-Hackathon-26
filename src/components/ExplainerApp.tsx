"use client";

import { FlaskConical } from "lucide-react";
import { useState } from "react";
import type { Analysis, DemographicOverrides, ReportSource } from "@/lib/domain/types";
import { ApiRequestError, postJson } from "@/lib/client/api";
import type { FixtureSummary } from "@/lib/server/fixtures";
import { Disclaimer } from "./Disclaimer";
import { ReportPicker } from "./ReportPicker";
import { ResultsView } from "./ResultsView";

interface Session {
  source: ReportSource;
  demographics: DemographicOverrides;
  analysis: Analysis;
}

export function ExplainerApp({ fixtures }: { fixtures: FixtureSummary[] }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(source: ReportSource, demographics: DemographicOverrides = {}): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const analysis = await postJson<Analysis>("/api/analyze", { source, demographics });
      setSession({ source, demographics, analysis });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Unexpected error while analysing the report.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-slate-900 p-2 text-white" aria-hidden="true">
            <FlaskConical className="size-5" />
          </span>
          <div>
            <p className="text-lg font-semibold leading-tight">CityLab Explain</p>
            <p className="text-sm text-slate-600">Understand your lab report, in plain language</p>
          </div>
        </div>
        {session && (
          <button
            type="button"
            onClick={() => {
              setSession(null);
              setError(null);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
          >
            End session &amp; choose another report
          </button>
        )}
      </header>

      <main className="flex-1">
        {error && (
          <div role="alert" className="mb-6 rounded-lg border border-slate-400 bg-white p-4 text-sm">
            <p className="font-semibold">The report could not be analysed</p>
            <p className="mt-1 text-slate-700">{error}</p>
          </div>
        )}
        {session ? (
          <ResultsView
            key={JSON.stringify(session.demographics)}
            analysis={session.analysis}
            source={session.source}
            demographics={session.demographics}
            pending={pending}
            onSupplyDemographics={(d) => analyze(session.source, { ...session.demographics, ...d })}
          />
        ) : (
          <ReportPicker fixtures={fixtures} pending={pending} onAnalyze={(source) => analyze(source)} />
        )}
      </main>

      <footer className="mt-10">
        <Disclaimer />
      </footer>
    </div>
  );
}
