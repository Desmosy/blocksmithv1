/**
 * Ambient types for the WebMCP browser API.
 *
 * WebMCP ships behind a flag (chrome://flags/#enable-webmcp-testing) and an
 * origin trial, so `document.modelContext` is absent in most browsers. Every
 * access must be feature-detected.
 *
 * Spec: https://github.com/webmachinelearning/webmcp
 * Note the object is `document.modelContext` — older explainers and some
 * third-party packages still say `navigator.modelContext`, which is stale.
 */

export type WebMcpContent = { type: "text"; text: string };

export type WebMcpResult = { content: WebMcpContent[] };

export type WebMcpAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type WebMcpToolDescriptor = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMcpAnnotations;
  execute: (args: Record<string, unknown>) => Promise<WebMcpResult> | WebMcpResult;
};

export type RegisterToolOptions = {
  /** Abort to unregister the tool. */
  signal?: AbortSignal;
  /** Secure origins allowed to discover this tool cross-origin. */
  exposedTo?: string[];
};

export interface ModelContext extends EventTarget {
  registerTool(
    tool: WebMcpToolDescriptor,
    options?: RegisterToolOptions,
  ): Promise<void>;
  getTools?(options?: { fromOrigins?: string[] }): Promise<unknown[]>;
  /**
   * Chrome takes arguments as a JSON string and returns a string — the spec
   * declares `Promise<DOMString>`, not a structured result. Callers parse it.
   */
  executeTool?(
    tool: unknown,
    args: string,
    options?: { signal?: AbortSignal },
  ): Promise<string>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

/** True when the page can register WebMCP tools. */
export function isWebMcpSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.modelContext?.registerTool === "function"
  );
}
