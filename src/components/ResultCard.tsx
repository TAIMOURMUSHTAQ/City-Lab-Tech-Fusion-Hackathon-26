import { AlertOctagon, BookOpen, MessageCircleQuestion } from "lucide-react";
import type { ExplainedResult } from "@/lib/domain/types";
import { formatRange, formatValue, joinDemographics, rangeGroup } from "@/lib/engine/facts";
import { STATUS_STYLE, rangeStatusLabel } from "./status";

function Source({ label, file, excerpt }: { label: string; file: string; excerpt: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm">
        <span className="font-medium">{file}</span>
        {excerpt && <code className="mt-1 block whitespace-pre-wrap break-words rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800">{excerpt}</code>}
      </dd>
    </div>
  );
}

export function ResultCard({ result: r }: { result: ExplainedResult }) {
  const style = STATUS_STYLE[r.classification];
  const name = r.canonicalTestName ?? r.rawTestName;
  const headingId = `result-${r.line}-${name.replace(/\W+/g, "-")}`;

  return (
    <article aria-labelledby={headingId} className={`rounded-xl border-2 bg-white p-5 ${style.border}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={headingId} className="text-lg font-semibold">
            {name}
          </h3>
          {r.canonicalTestName && r.canonicalTestName.toLowerCase() !== r.rawTestName.toLowerCase() && (
            <p className="text-sm text-slate-600">Reported as “{r.rawTestName}”</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${style.badge}`}>
            {r.urgent && <AlertOctagon className="size-4" aria-hidden="true" />}
            <span className="sr-only">Classification: </span>
            {style.label}
          </span>
          {r.urgent && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800 ring-1 ring-slate-300">
              Range status: {rangeStatusLabel(r.rangeStatus)}
            </span>
          )}
        </div>
      </header>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Recorded value</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums">{formatValue(r.rawValue, r.rawUnit)}</dd>
          {r.conversion && typeof r.normalizedValue === "number" && (
            <dd className="mt-1 text-sm text-slate-700">
              Converted: <span className="font-semibold tabular-nums">{formatValue(r.normalizedValue, r.normalizedUnit)}</span> (
              {r.conversion.fromUnit} × {r.conversion.factor})
            </dd>
          )}
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">CityLab reference range</dt>
          {r.referenceRange ? (
            <dd className="mt-0.5">
              <span className="text-xl font-semibold tabular-nums">{formatRange(r.referenceRange)}</span>
              <span className="block text-sm text-slate-600">
                {rangeGroup(r.referenceRange)}
                {r.referenceRange.kind === "numeric" && " · limits count as normal"}
              </span>
            </dd>
          ) : (
            <dd className="mt-0.5 text-sm text-slate-700">
              {r.rangeStatus === "needs_demographics"
                ? `Cannot be chosen until ${joinDemographics(r.missingDemographics)} ${r.missingDemographics.length > 1 ? "are" : "is"} provided.`
                : "Not available from the supplied files."}
            </dd>
          )}
        </div>
      </dl>

      {r.urgent && r.urgentReason && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-900 ring-1 ring-red-300">
          Critical threshold crossed: {r.urgentReason} See a doctor today.
        </p>
      )}

      <div className="mt-4">
        <h4 className="text-sm font-semibold">What this means</h4>
        <p className="mt-1 text-slate-800">{r.explanation}</p>
        {r.explanationSource === "llm" && (
          <p className="mt-1 text-xs text-slate-500">Wording rephrased by an AI model from the verified facts above; the classification is rule-based.</p>
        )}
      </div>

      {r.doctorQuestions.length > 0 && (
        <div className="mt-4">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold">
            <MessageCircleQuestion className="size-4" aria-hidden="true" /> Questions you could ask your doctor
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-800">
            {r.doctorQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="mt-4 rounded-md border border-slate-200 p-3">
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
          <BookOpen className="size-4" aria-hidden="true" /> Sources used
        </summary>
        <dl className="mt-3 space-y-3">
          {r.aliasSource && <Source label="Name mapping" file={r.aliasSource.file} excerpt={r.aliasSource.excerpt} />}
          {r.conversion && <Source label="Unit conversion" file={r.conversion.source.file} excerpt={r.conversion.source.excerpt} />}
          {r.sourceFile ? (
            <Source label="Reference range" file={r.sourceFile} excerpt={r.sourceExcerpt} />
          ) : (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Reference range</dt>
              <dd className="mt-0.5 text-sm text-slate-700">No CityLab reference file contains a usable range for this result.</dd>
            </div>
          )}
          {r.urgentThreshold && <Source label="Critical threshold" file={r.urgentThreshold.source.file} excerpt={r.urgentThreshold.source.excerpt} />}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Location in report</dt>
            <dd className="mt-0.5 text-sm">Line {r.line}</dd>
          </div>
        </dl>
      </details>
    </article>
  );
}
