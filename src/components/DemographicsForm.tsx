"use client";

import { Loader2, UserRoundSearch } from "lucide-react";
import { useId, useState } from "react";
import type { BiologicalSex, Demographic, DemographicOverrides, ExplainedResult } from "@/lib/domain/types";
import { DEMOGRAPHIC_LABEL } from "@/lib/engine/facts";

interface Props {
  missing: Demographic[];
  results: ExplainedResult[];
  pending: boolean;
  onSubmit: (values: DemographicOverrides) => void;
}

/** Asks for the missing age and/or biological sex. Never pre-fills or suggests a value. */
export function DemographicsForm({ missing, results, pending, onSubmit }: Props) {
  const ageId = useId();
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<BiologicalSex | "">("");
  const [error, setError] = useState<string | null>(null);

  const blocked = results.filter((r) => r.rangeStatus === "needs_demographics");
  const needAge = missing.includes("age");
  const needSex = missing.includes("biologicalSex");

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    const values: DemographicOverrides = {};
    if (needAge && age.trim() !== "") {
      const n = Number(age);
      if (!Number.isInteger(n) || n < 0 || n > 130) {
        setError("Age must be a whole number between 0 and 130.");
        return;
      }
      values.age = n;
    }
    if (needSex && sex !== "") values.biologicalSex = sex;
    if (Object.keys(values).length === 0) {
      setError("Please enter at least one missing value.");
      return;
    }
    setError(null);
    onSubmit(values);
  }

  return (
    <section aria-labelledby="missing-heading" className="rounded-xl border-2 border-slate-500 bg-white p-5">
      <h2 id="missing-heading" className="flex items-center gap-2 text-lg font-semibold">
        <UserRoundSearch className="size-5" aria-hidden="true" /> Missing information: {missing.map((d) => DEMOGRAPHIC_LABEL[d]).join(" and ")}
      </h2>
      <p className="mt-1 text-slate-700">
        This report does not record the patient&apos;s {missing.map((d) => DEMOGRAPHIC_LABEL[d]).join(" or ")}. CityLab reference
        ranges depend on age and biological sex, so we will not guess them from the name or anything else.
        {blocked.length > 0
          ? ` ${blocked.length} result${blocked.length > 1 ? "s" : ""} (${blocked.map((r) => r.canonicalTestName ?? r.rawTestName).join(", ")}) cannot be classified until you provide it.`
          : " No result in this report currently depends on it."}
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-4" noValidate>
        {needAge && (
          <div>
            <label htmlFor={ageId} className="block text-sm font-medium">
              Age (years)
            </label>
            <input
              id={ageId}
              type="number"
              inputMode="numeric"
              min={0}
              max={130}
              step={1}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
        )}
        {needSex && (
          <fieldset>
            <legend className="text-sm font-medium">Biological sex</legend>
            <div className="mt-1 flex gap-2">
              {(["Female", "Male"] as const).map((option) => (
                <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-100">
                  <input type="radio" name="biologicalSex" value={option} checked={sex === option} onChange={() => setSex(option)} />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Re-check with this information
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-slate-900">
          {error}
        </p>
      )}
    </section>
  );
}
