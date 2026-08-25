/**
 * Promote diff — production vs staging per block (PROJECT-PIPELINE.md §5).
 *
 * Human-readable field-level diff between the official version (what agents
 * use today) and the latest version (what promote would ship). Color values
 * are flagged so the UI can render swatches.
 */
import { getBlockHistory } from "./registry";
import type { BlockVersionRecord } from "./types";

export interface DiffField {
  key: string;
  production?: string;
  staging?: string;
  changed: boolean;
  /** Both sides parse as hex colors — render swatches. */
  isColor: boolean;
}

export interface PromoteDiff {
  id: string;
  title: string;
  type: string;
  productionVersion?: number;
  stagingVersion: number;
  stagingStatus: string;
  /** True when promote would change nothing (already official). */
  noop: boolean;
  fields: DiffField[];
}

function asDisplay(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(asDisplay).join("\n");
  return JSON.stringify(value);
}

function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(value.trim());
}

function diffRecords(
  production: BlockVersionRecord | undefined,
  staging: BlockVersionRecord,
): DiffField[] {
  const keys = new Set<string>([
    ...Object.keys(production?.content ?? {}),
    ...Object.keys(staging.content ?? {}),
  ]);
  const fields: DiffField[] = [];
  for (const key of [...keys].sort()) {
    const prod = production ? asDisplay(production.content[key]) : undefined;
    const stage = asDisplay(staging.content[key]);
    const changed = prod !== stage;
    fields.push({
      key,
      production: prod,
      staging: stage,
      changed,
      isColor:
        (prod != null && isHex(prod)) || (stage != null && isHex(stage)),
    });
  }
  // Changed fields first; agentHint and internals last.
  return fields.sort(
    (a, b) =>
      Number(b.changed) - Number(a.changed) || a.key.localeCompare(b.key),
  );
}

export function buildPromoteDiffs(
  docRef: string,
  blockIds: string[],
): PromoteDiff[] {
  const diffs: PromoteDiff[] = [];
  for (const id of blockIds) {
    const history = getBlockHistory(docRef, id);
    if (!history || history.versions.length === 0) continue;
    const staging = history.versions[history.versions.length - 1];
    const production =
      history.official != null
        ? history.versions.find((v) => v.version === history.official)
        : undefined;
    diffs.push({
      id,
      title: staging.title,
      type: staging.type,
      productionVersion: history.official,
      stagingVersion: staging.version,
      stagingStatus: staging.status,
      noop: history.official === staging.version,
      fields: diffRecords(production, staging),
    });
  }
  return diffs;
}
