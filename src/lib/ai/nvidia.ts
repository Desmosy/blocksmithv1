import {
  createNvidiaClient,
  getAiLabClient,
  getNvidiaProfile,
  isAiLabConfigured,
} from "@/ai-lab/shared/nvidia-profiles";

/** @deprecated Prefer `@/ai-lab` — kept for existing imports */
export function getNvidiaClient() {
  return getAiLabClient();
}

export function getNvidiaModel(): string {
  return getNvidiaProfile("chrome").model;
}

export function isNvidiaConfigured(): boolean {
  return isAiLabConfigured();
}

export { createNvidiaClient };
