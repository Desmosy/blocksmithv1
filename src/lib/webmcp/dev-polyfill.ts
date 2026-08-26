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
  WebMcpResult,
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

    async executeTool(
      tool: unknown,
      args: Record<string, unknown>,
    ): Promise<WebMcpResult> {
      const name = typeof tool === "string" ? tool : (tool as { name: string })?.name;
      const found = registry.get(name);
      if (!found) throw new Error(`No tool named "${name}".`);
      return found.execute(args ?? {});
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
