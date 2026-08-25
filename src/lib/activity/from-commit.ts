import type { ComponentDoc } from "@/lib/blocks/types";
import { appendActivity, listActivity, type ActivityEntry } from "./store";
import { gitAuthor, gitCommit } from "./git";

const UI_EXT = /\.(tsx?|jsx?|css|scss)$/i;

/** Map changed repo paths + commit message to design-system components. */
export function inferComponentsFromCommit(
  files: string[],
  commitMessage: string,
  components: ComponentDoc[],
): ComponentDoc[] {
  const uiFiles = files.filter((f) => UI_EXT.test(f));
  if (!uiFiles.length && !commitMessage.trim()) return [];

  const msg = commitMessage.toLowerCase();
  const matched = new Map<string, ComponentDoc>();

  for (const comp of components) {
    const id = comp.id.toLowerCase();
    const title = comp.title.toLowerCase();
    const idParts = id.split("-").filter((p) => p.length > 3);

    const textHit =
      msg.includes(id) ||
      msg.includes(title) ||
      idParts.some((p) => msg.includes(p));

    const fileHit = uiFiles.some((file) => {
      const path = file.toLowerCase();
      return (
        path.includes(id) ||
        idParts.some((p) => path.includes(p)) ||
        title.split(/\s+/).some((w) => w.length > 3 && path.includes(w))
      );
    });

    if (textHit || fileHit) matched.set(comp.id, comp);
  }

  return [...matched.values()];
}

export function commitAlreadyLogged(docRef: string, commit: string): boolean {
  if (!commit) return false;
  return listActivity(docRef).some((e) => e.commit === commit);
}

export function logActivityFromCommit(args: {
  docRef: string;
  components: ComponentDoc[];
  files: string[];
  summary: string;
  author?: string | null;
  commit?: string | null;
  contentHash?: string;
}): ActivityEntry[] {
  const commit = args.commit ?? gitCommit();
  if (commit && commitAlreadyLogged(args.docRef, commit)) return [];

  const hits = inferComponentsFromCommit(args.files, args.summary, args.components);
  if (!hits.length) return [];

  const author = args.author ?? gitAuthor() ?? "unknown";
  const logged: ActivityEntry[] = [];

  for (const comp of hits) {
    logged.push(
      appendActivity({
        docRef: args.docRef,
        componentId: comp.id,
        componentTitle: comp.title,
        author,
        action: "change",
        summary: args.summary.trim() || `Updated ${args.files.join(", ")}`,
        files: args.files,
        contentHash: args.contentHash,
        commit: commit ?? undefined,
        source: "git",
      }),
    );
  }

  return logged;
}
