# @block-smith/cli

Command-line tool for [BlockSmith](https://github.com/Desmosy/blocksmith). Promote design in the wiki, then pull governed rules and wire up Cursor MCP from your terminal.

Self-contained: one global install, no peer packages to manage.

## Install

```bash
npm install -g @block-smith/cli
```

Requires Node.js ≥ 18.

## Quick start

```bash
# 1. Create an API key in the wiki: Sync → API keys
blocksmith login --key bs_live_… --url https://blocksmith-mocha.vercel.app

# 2. Pull the rules you promoted into your repo (writes DESIGN.md + .blocksmith/)
blocksmith pull --doc upload:scan-your-kit.md

# 3. Wire Cursor MCP (pinned, promoted blocks only)
blocksmith setup cursor
# or create a key in the wiki → Sync → "Add to Cursor" one-click button
```

## Commands

| Command | What it does |
|---------|--------------|
| `login --key <bs_live_…> [--url <host>]` | Verify and save your API key (`--url` defaults to the hosted SaaS). |
| `whoami` | Show the account the key belongs to. |
| `scan [path]` | Scan a local repo and upload it to the server. |
| `scan --fixture vendor` | Scan the demo vendor on the server. |
| `scan --github <org/repo>` | Scan a public GitHub repo on the server. |
| `pull --doc <ref> [--workspace <path>]` | Pull promoted rules into `DESIGN.md` (auto-detects the git repo). |
| `codegen [--doc <ref>]` | Generate `@blocksmith/<slug>` from a scan (Pulse, early). |
| `mcp-url` | Print the remote MCP URL for Cursor. |
| `setup cursor [--global] [--workspace <path>]` | Write `.cursor/mcp.json` from saved login (merges if file exists). |
| `--version`, `--help` | Version / usage. |

Config is stored at `~/.blocksmith/config.json`.

> `blocksmith scan <localPath>` needs the BlockSmith scan engine on the machine
> (clone the repo and set `BLOCKSMITH_ROOT`). For a zero-setup scan use
> `--github` or `--fixture`, which run on the server.

## Develop / build

```bash
# from the monorepo root
npm run build -w @block-smith/cli      # bundles src + SDK into dist/cli.js
node packages/cli/dist/cli.js --help
```

The build (`build.mjs`) bundles the workspace `@blocksmith/sdk` straight from
source with esbuild, so the published artifact is a single dependency-free file.

## Publish (maintainers)

```bash
npm login                              # one time
npm publish -w @block-smith/cli         # prepublishOnly rebuilds the bundle
```

`@blocksmith/sdk` does **not** need to be published. It is bundled in.
