import { execSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";

export type LocalScanPayload = {
  markdown: string;
  fileName: string;
  projectName: string;
  workspaceRoot: string;
  scannedAt: string;
  colors: number;
  components: number;
  reactFiles: number;
  filesScanned: number;
  curated: boolean;
};

function findBlocksmithRoot(): string | null {
  const env = process.env.BLOCKSMITH_ROOT?.trim();
  if (env && existsSync(join(env, "scripts/scan-client.ts"))) return env;

  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "scripts/scan-client.ts"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function exportLocalScan(workspace: string): LocalScanPayload {
  const abs = resolve(workspace);
  if (!existsSync(abs)) {
    throw new Error(`Workspace not found: ${abs}`);
  }

  const root = findBlocksmithRoot();
  if (!root) {
    throw new Error(
      "Local scan needs BlockSmith scan engine. Clone BlockSmith and set BLOCKSMITH_ROOT, " +
        "or use: blocksmith scan --github org/repo / blocksmith scan --fixture vendor",
    );
  }

  const out = execSync(
    `npx tsx scripts/scan-client.ts --workspace ${JSON.stringify(abs)}`,
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, AI_LAB_SCAN_CURATE: "0" },
    },
  );

  const line = out.trim().split("\n").pop();
  if (!line) throw new Error("scan-client produced no output");
  return JSON.parse(line) as LocalScanPayload;
}
