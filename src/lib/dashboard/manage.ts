import "server-only";
import { isUploadDocRef, uploadFileNameFromRef } from "@/lib/uploads/store";
import {
  deleteUploadMarkdown,
  hydrateUploadMarkdown,
  persistUploadMarkdown,
  readUploadMarkdownContent,
} from "@/lib/uploads/persist";
import { unregisterDocument } from "@/lib/cloud/documents";
import { clearDesignSystemCache } from "@/lib/clients/registry";
import { cacheProjectMeta, deleteProjectMeta } from "./meta-cache";
import { parseProjectMeta } from "./projects";

/** A project can only be managed if it's an upload (created/imported/scanned). */
function fileNameForProject(docRef: string): string {
  if (!isUploadDocRef(docRef)) {
    throw new Error("This project is read-only and can't be modified.");
  }
  return uploadFileNameFromRef(docRef);
}

export async function deleteProject(docRef: string): Promise<void> {
  const fileName = fileNameForProject(docRef);
  await deleteUploadMarkdown(fileName);
  await unregisterDocument(fileName);
  await deleteProjectMeta(fileName);
  clearDesignSystemCache();
}

/** Set the project's display name in frontmatter + the first H1 (preserving any suffix). */
function setProjectName(md: string, name: string): string {
  let out = md;
  const fm = out.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    let block = fm[1];
    block = /^project-name:.*$/m.test(block)
      ? block.replace(/^project-name:.*$/m, `project-name: ${name}`)
      : `${block}\nproject-name: ${name}`;
    out = out.replace(/^---\n[\s\S]*?\n---/, `---\n${block}\n---`);
  }
  out = out.replace(/^#\s+(.+)$/m, (_full, title: string) => {
    const suffix = title.match(/\s—\s.+$/); // keep "— Workspace Scan" / "— Style Reference"
    return `# ${name}${suffix ? suffix[0] : ""}`;
  });
  return out;
}

export async function renameProject(
  docRef: string,
  rawName: string,
): Promise<string> {
  const name = rawName.trim().slice(0, 80);
  if (!name) throw new Error("Give the project a name.");
  const fileName = fileNameForProject(docRef);
  await hydrateUploadMarkdown(fileName);
  const md = await readUploadMarkdownContent(fileName);
  const updated = setProjectName(md, name);
  await persistUploadMarkdown(fileName, updated);
  await cacheProjectMeta(fileName, parseProjectMeta(fileName, updated));
  clearDesignSystemCache();
  return name;
}
