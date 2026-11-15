import { ShieldAlert } from "lucide-react";

export function Disclaimer() {
  return (
    <aside aria-label="Medical disclaimer" className="flex gap-3 rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-700">
      <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold text-slate-900">Medical disclaimer</p>
        <p>
          This is educational information only and is <strong>not a diagnosis</strong>. Only a licensed clinician can diagnose a
          medical condition or interpret what your results mean for you. Classifications come only from the CityLab reference files.
        </p>
        <p>
          <strong>Urgent warnings require appropriate medical attention.</strong> If a result is marked urgent, see a doctor today.
        </p>
      </div>
    </aside>
  );
}
