/**
 * Goal 2.5 — governance copilot drafts role + description from a prompt.
 * Skips when NVIDIA_API_KEY is unset (manual edit path still works).
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  governanceCopilotEnabled,
  draftComponentGovernance,
} from "../src/ai-lab/10-governance-copilot/draft";

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

async function main() {
  if (!governanceCopilotEnabled()) {
    console.log("[verify:governance-copilot] SKIP — NVIDIA_API_KEY not set");
    process.exit(0);
  }

  const draft = await draftComponentGovernance({
    componentTitle: "Button",
    componentId: "button",
    currentRole: "",
    currentDescription: "",
    userPrompt:
      "Primary CTA on marketing pages only. Max one per view. Use secondary for cancel.",
    scanContext: {
      sourceFile: "src/components/ui/button.tsx",
      exports: ["Button", "buttonVariants"],
      cssVarsUsed: ["--primary", "--primary-foreground"],
      colorsUsed: ["hsl(var(--primary))"],
    },
  });

  if (!draft.role.trim()) {
    throw new Error("Expected non-empty role");
  }
  if (!draft.description.trim()) {
    throw new Error("Expected non-empty description");
  }

  console.log("[verify:governance-copilot] OK");
  console.log("  model:", draft.model);
  console.log("  role:", draft.role.slice(0, 80));
  console.log("  description:", draft.description.slice(0, 120) + "…");
}

main().catch((err) => {
  console.error("[verify:governance-copilot] FAIL", err);
  process.exit(1);
});
