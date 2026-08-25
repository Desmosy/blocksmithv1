#!/usr/bin/env node
import { BlockSmith } from "@blocksmith/sdk";
import { Command } from "commander";
import { saveConfig, loadConfig, configPath } from "./config.js";
import { flagStr, type Flags } from "./args.js";
import { pullOverrides } from "./pull.js";
import { exportLocalScan } from "./scan-local.js";
import { cmdSetupCursor } from "./cursor-setup.js";
import { cmdSetupHooks } from "./setup-hooks.js";
import { cmdCheck } from "./check.js";

/** Injected at build time by build.mjs (esbuild `define`). */
declare const __CLI_VERSION__: string;
const VERSION =
  typeof __CLI_VERSION__ !== "undefined" ? __CLI_VERSION__ : "0.0.0-dev";

/** Default hosted SaaS — overridable with `--url`. */
const DEFAULT_BASE_URL = "https://blocksmith-mocha.vercel.app";

/** Require login; print an actionable message and exit otherwise. */
function requireClient(): BlockSmith {
  const config = loadConfig();
  if (!config) {
    fail(
      "Not logged in. Run:\n  blocksmith login --key bs_live_… --url <host>\n" +
        "Create a key in the wiki under Sync → API keys.",
    );
  }
  return new BlockSmith(config);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function cmdLogin(flags: Flags): Promise<void> {
  const key = flagStr(flags, "key", "k");
  const baseUrl = flagStr(flags, "url", "u") ?? DEFAULT_BASE_URL;
  if (!key) {
    fail("login requires --key bs_live_…");
  }
  if (!key.startsWith("bs_live_")) {
    fail("Invalid key: API keys start with 'bs_live_'.");
  }

  // Verify the key against the server before persisting it.
  const client = new BlockSmith({ apiKey: key, baseUrl });
  const me = await client.me();
  saveConfig({ apiKey: key, baseUrl });
  console.log(`Logged in as ${me.key.label} (${me.key.prefix}…)`);
  console.log(`Server: ${baseUrl}`);
  console.log(`Config: ${configPath()}`);
}

async function cmdWhoami(client: BlockSmith): Promise<void> {
  const me = await client.me();
  console.log(JSON.stringify(me, null, 2));
}

function cmdMcpUrl(client: BlockSmith): void {
  console.log(client.mcpUrl());
  console.log("\nCursor remote MCP — add header: Authorization: Bearer <your api key>");
}

async function cmdCodegen(client: BlockSmith, flags: Flags): Promise<void> {
  const doc = flagStr(flags, "doc", "d");
  const result = await client.codegen.pulse({ doc });
  console.log("Pulse codegen complete");
  console.log(`  Package:   ${result.packageName}`);
  console.log(`  Output:    ${result.outDir}`);
  console.log(`  Doc:       ${result.docRef}`);
  console.log(`  Demo:      ${result.demoUrl}`);
  console.log("");
  console.log(result.importExample);
  console.log("");
  for (const step of result.nextSteps) console.log(`  → ${step}`);
}

async function cmdPull(client: BlockSmith, flags: Flags): Promise<void> {
  const doc = flagStr(flags, "doc", "d");
  const workspace = flagStr(flags, "workspace", "w");
  if (!doc) {
    fail("pull requires --doc <ref>, e.g. --doc upload:scan-your-kit.md");
  }
  await pullOverrides(client, doc, workspace);
}

async function cmdScan(
  client: BlockSmith,
  positionals: string[],
  flags: Flags,
): Promise<void> {
  const fixture = flagStr(flags, "fixture");
  const github = flagStr(flags, "github");
  const pathArg = positionals[0];

  if (pathArg) {
    console.log(`Scanning locally: ${pathArg}`);
    const payload = exportLocalScan(pathArg);
    const result = await client.scans.create({ clientScan: payload });
    console.log("Scan complete (client upload)");
    printScan(result);
    return;
  }

  const result = await client.scans.create({
    fixture: fixture === "vendor" ? "vendor" : undefined,
    github,
  });
  console.log("Scan complete");
  if (result.githubUrl) console.log(`  GitHub:    ${result.githubUrl}`);
  printScan(result);
}

function printScan(result: {
  scanMode: string;
  projectName: string;
  docRef: string;
  wikiUrl: string;
  components: number;
}): void {
  console.log(`  Mode:      ${result.scanMode}`);
  console.log(`  Project:   ${result.projectName}`);
  console.log(`  Doc:       ${result.docRef}`);
  console.log(`  Wiki:      ${result.wikiUrl}`);
  console.log(`  Featured:  ${result.components}`);
}

async function main(): Promise<void> {
  const program = new Command()
    .name("blocksmith")
    .description("Developer-friendly design governance")
    .version(VERSION, "-v, --version");
  const flags = (opts: Record<string, unknown>) => opts as Flags;

  program.command("login").requiredOption("-k, --key <key>").option("-u, --url <url>").action((o) => cmdLogin(flags(o)));
  program.command("whoami").action(() => cmdWhoami(requireClient()));
  program.command("mcp-url").action(() => cmdMcpUrl(requireClient()));
  program.command("codegen").option("-d, --doc <ref>").action((o) => cmdCodegen(requireClient(), flags(o)));
  program.command("pull").requiredOption("-d, --doc <ref>").option("-w, --workspace <path>").action((o) => cmdPull(requireClient(), flags(o)));
  program.command("scan [path]").option("--fixture <name>").option("--github <repo>").action((path, o) => cmdScan(requireClient(), path ? [path] : [], flags(o)));
  program.command("check [paths...]").option("--doc <ref>").option("--base <range>").option("--staged").option("--strict").option("--record").option("--reason <reason>").option("--format <format>").option("--hook").action((paths, o) => cmdCheck(requireClient(), paths, flags(o)));
  const setup = program.command("setup").description("Install hooks or Cursor MCP rules");
  setup.command("cursor").option("-g, --global").option("-w, --workspace <path>").action((o) => cmdSetupCursor(flags(o)));
  setup.command("hooks").option("-d, --doc <ref>").option("--strict").action((o) => cmdSetupHooks(flags(o)));

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  if (/401|403|unauthor|api key|invalid key/i.test(message)) {
    console.error(
      "Hint: your API key may be invalid or expired. Create a new one under Sync → API keys, then run blocksmith login.",
    );
  }
  process.exit(1);
});
