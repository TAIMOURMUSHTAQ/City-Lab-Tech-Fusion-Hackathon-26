import type { SourceRef } from "@/lib/domain/types";
import { ALIASES, CANONICAL_TESTS, type CanonicalTest } from "@/lib/knowledge/tables";
import { stripEmphasis } from "./parser";

export interface AliasResolution {
  canonical: CanonicalTest;
  /** Glossary/reference line that justified the mapping; null when the raw name is already canonical. */
  source: SourceRef | null;
}

const key = (name: string): string => stripEmphasis(name).replace(/\s+/g, " ").toLowerCase();

const CANONICAL_BY_KEY = new Map<string, CanonicalTest>(CANONICAL_TESTS.map((name) => [key(name), name]));
const ALIAS_BY_KEY = new Map(ALIASES.map((entry) => [key(entry.alias), entry]));

/** Maps a raw report test name to its canonical name, or null if the files do not know it. */
export function resolveTestName(rawName: string): AliasResolution | null {
  const k = key(rawName);
  const canonical = CANONICAL_BY_KEY.get(k);
  if (canonical) return { canonical, source: null };
  const alias = ALIAS_BY_KEY.get(k);
  if (alias) return { canonical: alias.canonical, source: alias.source };
  return null;
}

/** All names (canonical + aliases) that refer to a canonical test. Used for question matching. */
export function namesFor(canonical: CanonicalTest): string[] {
  return [canonical, ...ALIASES.filter((a) => a.canonical === canonical).map((a) => a.alias)];
}
