"use client";

import { FileText, Loader2, Upload } from "lucide-react";
import { useId, useState } from "react";
import { MAX_MARKDOWN_BYTES, type ReportSource } from "@/lib/domain/types";
import type { FixtureSummary } from "@/lib/server/fixtures";

interface Props {
  fixtures: FixtureSummary[];
  pending: boolean;
  onAnalyze: (source: ReportSource) => void;
}

export function ReportPicker({ fixtures, pending, onAnalyze }: Props) {
  const selectId = useId();
  const textId = useId();
  const fileId = useId();
  const [fixtureId, setFixtureId] = useState(fixtures[0]?.id ?? "");
  const [markdown, setMarkdown] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  async function loadFile(file: File | undefined): Promise<void> {
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_MARKDOWN_BYTES) {
      setFileError(`File is too large (max ${Math.round(MAX_MARKDOWN_BYTES / 1000)} KB).`);
      return;
    }
    try {
      setMarkdown(await file.text());
    } catch {
      setFileError("The file could not be read.");
    }
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="purpose" className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 id="purpose" className="text-2xl font-semibold">
          Explain a CityLab report
        </h1>
        <p className="mt-2 max-w-3xl text-slate-700">
          CityLab Explain reads a laboratory report, compares each value with the CityLab reference files using fixed rules, and
          explains the result in plain language. It flags values past CityLab&apos;s critical thresholds, asks for missing age or
          sex instead of guessing, and says so when a test cannot be classified from the files. It does not diagnose.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <form
          className="rounded-xl border border-slate-200 bg-white p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (fixtureId) onAnalyze({ fixtureId });
          }}
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="size-5" aria-hidden="true" /> Supplied report
          </h2>
          <label htmlFor={selectId} className="mt-4 block text-sm font-medium">
            Report
          </label>
          <select
            id={selectId}
            value={fixtureId}
            onChange={(e) => setFixtureId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            {fixtures.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id} · {f.label}
              </option>
            ))}
          </select>
          <SubmitButton pending={pending} disabled={!fixtureId} />
        </form>

        <form
          className="rounded-xl border border-slate-200 bg-white p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (markdown.trim()) onAnalyze({ markdown });
          }}
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Upload className="size-5" aria-hidden="true" /> Your own Markdown report
          </h2>
          <label htmlFor={fileId} className="mt-4 block text-sm font-medium">
            Upload a .md file
          </label>
          <input
            id={fileId}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={(e) => void loadFile(e.target.files?.[0])}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-1.5"
          />
          {fileError && (
            <p role="alert" className="mt-1 text-sm text-slate-800">
              {fileError}
            </p>
          )}
          <label htmlFor={textId} className="mt-4 block text-sm font-medium">
            …or paste it here
          </label>
          <textarea
            id={textId}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={6}
            maxLength={MAX_MARKDOWN_BYTES}
            placeholder={"## Results\n- Hemoglobin: 13.5 g/dL"}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-slate-600">Processed in memory for this request only; nothing is stored.</p>
          <SubmitButton pending={pending} disabled={!markdown.trim()} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      Explain report
    </button>
  );
}
