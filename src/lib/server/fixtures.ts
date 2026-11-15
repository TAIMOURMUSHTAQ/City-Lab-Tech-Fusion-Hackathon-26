import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ReportError } from "@/lib/domain/types";
import type { KnownPatient } from "@/lib/engine/contextLock";
import { parseReport } from "@/lib/engine/parser";

const REPORTS_DIR = path.join(process.cwd(), "lab_reports");
const FIXTURE_FILE = /^report_(P\d{3})_(.+)\.md$/;

export interface FixtureSummary {
  id: string;
  label: string;
}

interface FixtureFile extends FixtureSummary {
  fileName: string;
}

let fixtureCache: Promise<FixtureFile[]> | null = null;
let patientCache: Promise<KnownPatient[]> | null = null;

async function listFixtureFiles(): Promise<FixtureFile[]> {
  const names = await readdir(REPORTS_DIR);
  return names
    .map((fileName) => {
      const match = FIXTURE_FILE.exec(fileName);
      return match?.[1] && match[2] ? { id: match[1], label: match[2].replace(/_/g, " "), fileName } : null;
    })
    .filter((f): f is FixtureFile => f !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function fixtures(): Promise<FixtureFile[]> {
  fixtureCache ??= listFixtureFiles().catch((error: unknown) => {
    fixtureCache = null; // do not cache a failed directory read
    throw error;
  });
  return fixtureCache;
}

export async function listFixtures(): Promise<FixtureSummary[]> {
  return (await fixtures()).map(({ id, label }) => ({ id, label }));
}

/** Loads a fixture by id from a server-side allow-list (no user-controlled paths). */
export async function loadFixture(id: string): Promise<string> {
  const file = (await fixtures()).find((f) => f.id === id);
  if (!file) throw new ReportError("fixture_not_found", `No supplied report has id "${id}".`);
  return readFile(path.join(REPORTS_DIR, file.fileName), "utf8");
}

/** Identities of every supplied patient, used ONLY to detect (and refuse) cross-patient questions. */
export function knownPatients(): Promise<KnownPatient[]> {
  patientCache ??= (async () => {
    const all = await fixtures();
    const patients = await Promise.all(
      all.map(async (f) => {
        const { demographics } = parseReport(await loadFixture(f.id));
        return demographics.name ? { name: demographics.name, mrn: demographics.mrn } : null;
      }),
    );
    return patients.filter((p): p is KnownPatient => p !== null);
  })().catch((error: unknown) => {
    patientCache = null;
    throw error;
  });
  return patientCache;
}
