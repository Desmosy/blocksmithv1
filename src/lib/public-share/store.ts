import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import type {
  CreateShareInput,
  OpinionReaction,
  PublicShareRecord,
  RecordOpinionInput,
  ShareStats,
} from "./types";
import { resolveBlock } from "./resolve-block";

const DATA_DIR = join(process.cwd(), "data/public-share");

function sharePath(id: string): string {
  return join(DATA_DIR, `${id}.json`);
}

function emptyStats(): ShareStats {
  return {
    views: 0,
    opinions: { approve: 0, unsure: 0, reject: 0 },
  };
}

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function createShare(
  input: CreateShareInput,
): Promise<PublicShareRecord> {
  const existing = await findShareByBlock(input);
  if (existing) return existing;

  const resolved = resolveBlock(input);
  await ensureDataDir();

  const record: PublicShareRecord = {
    id: randomUUID().replace(/-/g, "").slice(0, 12),
    createdAt: new Date().toISOString(),
    docFileName: input.docFileName,
    systemName: resolved.systemName,
    blockKind: input.blockKind,
    blockId: input.blockId,
    blockTitle: resolved.blockTitle,
    contentHash: resolved.contentHash,
    enabled: true,
    stats: emptyStats(),
  };

  await writeFile(sharePath(record.id), JSON.stringify(record, null, 2), "utf-8");
  return record;
}

export async function getShare(id: string): Promise<PublicShareRecord | null> {
  try {
    const raw = await readFile(sharePath(id), "utf-8");
    return JSON.parse(raw) as PublicShareRecord;
  } catch {
    return null;
  }
}

export async function findShareByBlock(
  input: CreateShareInput,
): Promise<PublicShareRecord | null> {
  await ensureDataDir();
  let files: string[] = [];
  try {
    files = (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    return null;
  }

  for (const file of files) {
    try {
      const raw = await readFile(join(DATA_DIR, file), "utf-8");
      const record = JSON.parse(raw) as PublicShareRecord;
      if (
        record.docFileName === input.docFileName &&
        record.blockKind === input.blockKind &&
        record.blockId === input.blockId &&
        record.enabled
      ) {
        return record;
      }
    } catch {
      /* skip corrupt file */
    }
  }
  return null;
}

async function saveShare(record: PublicShareRecord): Promise<void> {
  await writeFile(sharePath(record.id), JSON.stringify(record, null, 2), "utf-8");
}

export async function recordView(shareId: string): Promise<ShareStats | null> {
  const record = await getShare(shareId);
  if (!record || !record.enabled) return null;
  record.stats.views += 1;
  await saveShare(record);
  return record.stats;
}

export async function recordOpinion(
  shareId: string,
  input: RecordOpinionInput,
): Promise<ShareStats | null> {
  const record = await getShare(shareId);
  if (!record || !record.enabled) return null;

  const key = input.reaction as OpinionReaction;
  if (key === "approve" || key === "unsure" || key === "reject") {
    record.stats.opinions[key] += 1;
  }

  await saveShare(record);
  return record.stats;
}

export function publicShareUrl(shareId: string, origin?: string): string {
  const base = origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/share/${shareId}`;
}
