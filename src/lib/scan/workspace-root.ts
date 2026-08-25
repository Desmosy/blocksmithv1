import { existsSync, readFileSync, realpathSync, statSync } from "fs";
import { basename, resolve } from "path";

/** Absolute path to the vendor project BlockSmith should scan (their repo, not only BlockSmith). */
export function resolveWorkspaceRoot(override?: string): string {
  const raw =
    override?.trim() ||
    process.env.BLOCKSMITH_WORKSPACE?.trim() ||
    process.cwd();

  const abs = resolve(raw);
  if (!existsSync(abs)) {
    throw new Error(`Workspace not found: ${abs}`);
  }
  const st = statSync(abs);
  if (!st.isDirectory()) {
    throw new Error(`Workspace is not a directory: ${abs}`);
  }
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

export function workspaceProjectName(root: string): string {
  try {
    const raw = readFileSync(resolve(root, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as { name?: string };
    if (pkg?.name?.trim()) return pkg.name.trim();
  } catch {
    /* no package.json */
  }
  return basename(root);
}
