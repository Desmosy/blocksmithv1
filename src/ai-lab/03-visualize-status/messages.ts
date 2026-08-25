export type VisualizeCompileMode = "ai" | "deterministic" | "unavailable";

export function visualizeStatusMessage(mode: VisualizeCompileMode): string {
  switch (mode) {
    case "ai":
      return "Design preview active (AI refined)";
    case "deterministic":
      return "Design preview active (semantic chrome)";
    case "unavailable":
      return "Add design tokens to visualize";
  }
}

/** Background AI refine failed — semantic preview still works. */
export function visualizeAiRefineWarning(error?: string): string | null {
  if (!error) return null;
  if (error.includes("NVIDIA_API_KEY")) {
    return "AI refine unavailable — using semantic chrome from your scan.";
  }
  if (error.includes("timed out")) {
    return "AI refine timed out — preview uses semantic chrome from your scan.";
  }
  return `AI refine skipped — ${error}`;
}

/** Hard failure when visualize cannot run at all (legacy / API-only paths). */
export function visualizeAiWarning(error?: string): string | null {
  if (!error) return null;
  if (error.includes("NVIDIA_API_KEY")) {
    return "AI Lab offline — add NVIDIA_API_KEY on the server for AI polish.";
  }
  return `Visualize failed: ${error}`;
}
