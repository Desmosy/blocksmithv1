// Bundles the CLI (including @blocksmith/sdk) into a single zero-dependency
// ESM file so `npm i -g @block-smith/cli` works with nothing else to install.
import { build } from "esbuild";
import { chmodSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, "package.json"), "utf-8"));
const outfile = join(here, "dist/cli.js");

// Clean stale output so only the single bundled file ships.
rmSync(join(here, "dist"), { recursive: true, force: true });

await build({
  entryPoints: [join(here, "src/cli.ts")],
  outfile,
  bundle: true,
  // Commander is ESM-aware at runtime; externalizing avoids esbuild wrapping
  // its Node built-in imports in a dynamic require shim.
  external: ["commander"],
  platform: "node",
  format: "esm",
  target: "node18",
  // Bundle the workspace SDK from source — no separate npm package needed.
  alias: {
    "@blocksmith/sdk": join(here, "../sdk/src/index.ts"),
  },
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
  legalComments: "none",
  logLevel: "info",
});

// Make the entry executable (npm also does this on install via "bin").
chmodSync(outfile, 0o755);
console.log(`Built ${outfile} (v${pkg.version})`);
