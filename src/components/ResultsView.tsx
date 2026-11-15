"use client";

import { AlertTriangle, Lock } from "lucide-react";
import type { Analysis, DemographicOverrides, DemographicSource, ReportSource } from "@/lib/domain/types";
import { AskPanel } from "./AskPanel";
import { DemographicsForm } from "./DemographicsForm";
import { ResultCard } from "./ResultCard";

interface Props {
  analysis: Analysis;
  source: ReportSource;
  demographics: DemographicOverrides;
  pending: boolean;
  onSupplyDemographics: (values: DemographicOverrides) => void;
}

function Field({ label, value, origin }: { label: string; value: string | null; origin?: DemographicSource }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium">
        {value ?? <span className="text-slate-600">Not provided</span>}
        {origin === "user" && <span className="ml-1 text-xs font-normal text-slate-600">(supplied by you)</span>}
      </dd>
    </div>
  );
}

export function ResultsView({ analysis, source, demographics, pending, onSupplyDemographics }: Props) {
  const { patient, results } = analysis;
  const urgent = results.filter((r) => r.urgent);
  // Urgent results first, then abnormal, then everything else, preserving report order within each group.
  const rank = (c: string) => (c === "urgent" ? 0 : c === "low" || c === "high" ? 1 : c === "needs_demographics" ? 2 : 3);
  const ordered = [...results].sort((a, b) => rank(a.classification) - rank(b.classification));

  return (
    <div className="space-y-6">
      {urgent.length > 0 && (
        <section role="alert" aria-labelledby="urgent-heading" className="rounded-xl border-2 border-red-700 bg-red-50 p-5 text-red-950">
          <h2 id="urgent-heading" className="flex items-center gap-2 text-xl font-bold">
            <AlertTriangle className="size-6" aria-hidden="true" /> Urgent: see a doctor today
          </h2>
          <p className="mt-1">
            {urgent.length === 1 ? "One result has" : `${urgent.length} results have`} crossed a CityLab critical threshold:{" "}
            <strong>{urgent.map((r) => r.canonicalTestName ?? r.rawTestName).join(", ")}</strong>. This warning requires appropriate
            medical attention. It is not a diagnosis.
          </p>
        </section>
      )}

      <section aria-labelledby="patient-heading" className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 id="patient-heading" className="text-2xl font-semibold">
            {patient.name}
          </h1>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
            <Lock className="size-4" aria-hidden="true" /> Session locked to this patient
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Field label="Age" value={patient.age === null ? null : String(patient.age)} origin={analysis.demographicsSource.age} />
          <Field label="Biological sex" value={patient.biologicalSex} origin={analysis.demographicsSource.biologicalSex} />
          <Field label="MRN" value={patient.mrn} />
          <Field label="Issued" value={patient.issueDate} />
          <Field label="Results" value={String(results.length)} />
        </dl>
      </section>

      {analysis.missingDemographics.length > 0 && (
        <DemographicsForm missing={analysis.missingDemographics} results={results} pending={pending} onSubmit={onSupplyDemographics} />
      )}

      <section aria-labelledby="results-heading" className="space-y-4">
        <h2 id="results-heading" className="text-xl font-semibold">
          Results
        </h2>
        {ordered.map((r) => (
          <ResultCard key={`${r.line}-${r.rawTestName}`} result={r} />
        ))}
      </section>

      {analysis.warnings.length > 0 && (
        <section aria-labelledby="warnings-heading" className="rounded-xl border border-slate-300 bg-white p-5 text-sm">
          <h2 id="warnings-heading" className="font-semibold">
            Notes from reading the report
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            {analysis.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <AskPanel patientName={patient.name} source={source} demographics={demographics} />
    </div>
  );
}
