"use client";

import { useEffect, useRef, useState } from "react";
import {
  isWebMcpSupported,
  type WebMcpAnnotations,
  type WebMcpResult,
} from "@/lib/webmcp/types";
import { installDevPolyfill } from "@/lib/webmcp/dev-polyfill";

export type WebMcpToolSpec = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMcpAnnotations;
  execute: (args: Record<string, unknown>) => Promise<string> | string;
};

export type WebMcpStatus = {
  /** The browser exposes document.modelContext. */
  supported: boolean;
  /** Names currently registered by this hook. */
  registered: string[];
  error: string | null;
};

/**
 * Register WebMCP tools for as long as the calling component is mounted.
 *
 * Registration is tied to an AbortController: unmounting (or a change to
 * `tools`) aborts it, which is how the spec unregisters. That keeps tools
 * honest about page state — a tool only exists while the UI backing it does.
 *
 * `execute` returns plain text here; the spec's `{ content: [...] }` envelope
 * is applied below so callers never hand-build it.
 */
export function useWebMcp(tools: WebMcpToolSpec[]): WebMcpStatus {
  const [status, setStatus] = useState<WebMcpStatus>({
    supported: false,
    registered: [],
    error: null,
  });

  // Keep the latest implementations without re-registering on every render.
  const toolsRef = useRef(tools);
  toolsRef.current = tools;

  // Re-register when anything the agent can see changes — not just names.
  // A schema whose enum tracks the active design system is the whole point of
  // a live tool surface, and keying on names alone would silently skip it.
  const key = JSON.stringify(
    tools.map((t) => [t.name, t.description, t.inputSchema, t.annotations]),
  );

  useEffect(() => {
    // `?agent=sim`, in development only. Two documents told readers this
    // worked and nothing ever called it, so the flag was inert everywhere —
    // including for anyone following our own testing instructions.
    installDevPolyfill();
    if (!isWebMcpSupported()) {
      setStatus({ supported: false, registered: [], error: null });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      const registered: string[] = [];
      try {
        for (const tool of toolsRef.current) {
          await document.modelContext!.registerTool(
            {
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
              annotations: tool.annotations,
              execute: async (args): Promise<WebMcpResult> => {
                // Look the implementation up at call time so a re-render
                // picks up fresh closures (current doc, current page state).
                const live =
                  toolsRef.current.find((t) => t.name === tool.name) ?? tool;
                const text = await live.execute(args ?? {});
                return { content: [{ type: "text", text }] };
              },
            },
            { signal: controller.signal },
          );
          registered.push(tool.name);
        }
        if (!cancelled) setStatus({ supported: true, registered, error: null });
      } catch (err) {
        if (cancelled) return;
        // NotAllowedError means the API exists but permissions are off.
        const message =
          err instanceof Error ? err.message : "Tool registration failed.";
        setStatus({ supported: true, registered, error: message });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key]);

  return status;
}
