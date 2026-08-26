/**
 * A minimal, spec-shaped `document.modelContext` for local testing.
 *
 * WebMCP ships behind a Chrome flag and an origin trial, so the registration
 * path is otherwise unverifiable on a machine that doesn't have it enabled —
 * which is most machines, including CI. This installs just enough of the API to
 * exercise register / list / execute / unregister and the `toolchange` event.
 *
 * It is NEVER installed in production and never installed unless explicitly
 * asked for via `?agent=sim`. It does not make the page agent-capable; it makes
 * our own wiring testable.
 */

import type {
  ModelContext,
  RegisterToolOptions,
  WebMcpToolDescriptor,
} from "./types";

const FLAG = "__blocksmithWebMcpShim";

type ShimContext = ModelContext & {
  [FLAG]?: true;
  /** Test affordance: the tools currently registered. */
  listTools?: () => { name: string; description: string }[];
};

export function isShimInstalled(): boolean {
  return (
    typeof document !== "undefined" &&
    Boolean((document.modelContext as ShimContext | undefined)?.[FLAG])
  );
}

/**
 * Install the shim if the environment asks for it. Returns true when this call
 * (or a previous one) left a shim in place.
 */
export function installDevPolyfill(): boolean {
  if (typeof document === "undefined") return false;
  if (process.env.NODE_ENV === "production") return false;

  const wanted =
    new URLSearchParams(window.location.search).get("agent") === "sim";
  if (!wanted) return false;

  // Never shadow a real implementation.
  if (document.modelContext && !isShimInstalled()) return false;
  if (isShimInstalled()) return true;

  const registry = new Map<string, WebMcpToolDescriptor>();
  const target = new EventTarget();

  const emitChange = () => {
    target.dispatchEvent(new Event("toolchange"));
  };

  const context: ShimContext = Object.assign(target, {
    [FLAG]: true as const,

    async registerTool(
      tool: WebMcpToolDescriptor,
      options?: RegisterToolOptions,
    ): Promise<void> {
      if (!tool?.name) throw new Error("Tool requires a name.");
      registry.set(tool.name, tool);
      options?.signal?.addEventListener("abort", () => {
        // Only remove if this exact registration is still the live one — a
        // re-register under the same name must not be undone by a stale abort.
        if (registry.get(tool.name) === tool) {
          registry.delete(tool.name);
          emitChange();
        }
      });
      emitChange();
    },

    async getTools() {
      return [...registry.values()];
    },

    /**
     * Matches Chrome's shape deliberately: arguments arrive as a JSON string
     * and the result comes back as a string, per the spec's
     * `Promise<DOMString> executeTool(...)`. An earlier version took and
     * returned objects, which meant anything verified against the shim broke
     * the moment it met a real browser.
     */
    async executeTool(
      tool: unknown,
      args: string | Record<string, unknown>,
    ): Promise<string> {
      const name =
        typeof tool === "string" ? tool : (tool as { name?: string })?.name ?? "";
      const found = registry.get(name);
      if (!found) throw new Error(`No tool named "${name}".`);

      let parsed: Record<string, unknown> = {};
      if (typeof args === "string") {
        try {
          parsed = args.trim() ? JSON.parse(args) : {};
        } catch {
          throw new Error("Failed to parse input arguments");
        }
      } else if (args && typeof args === "object") {
        parsed = args;
      }
      return JSON.stringify(await found.execute(parsed));
    },

    listTools() {
      return [...registry.values()].map((t) => ({
        name: t.name,
        description: t.description,
      }));
    },
  }) as ShimContext;

  Object.defineProperty(document, "modelContext", {
    value: context,
    configurable: true,
    writable: true,
  });

  return true;
}
