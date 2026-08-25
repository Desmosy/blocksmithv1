const VISUALIZE_STORAGE_KEY = "blocksmith-visualize";

function visualizeKey(fileName: string): string {
  return `${VISUALIZE_STORAGE_KEY}:${fileName}`;
}

export function loadVisualizePreference(fileName: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(visualizeKey(fileName)) === "1";
}

export function saveVisualizePreference(
  fileName: string,
  applied: boolean,
): void {
  if (typeof window === "undefined") return;
  if (applied) {
    localStorage.setItem(visualizeKey(fileName), "1");
  } else {
    localStorage.removeItem(visualizeKey(fileName));
  }
}
