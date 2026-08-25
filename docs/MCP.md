# BlockSmith MCP — Cursor, Claude & any MCP client

The MCP server exposes the **same blocks** as the wiki (`.blocksmith/blocks/`). Agents read design truth from disk; the wiki renders it for humans.

**Governance travels with the connector** — not with repo-injected rule files. When someone adds BlockSmith in Cursor chat, Claude connectors, or VS Code MCP, they get server `instructions`, the `governed_ui_task` prompt, and enforcement tools automatically. No `CLAUDE.md`, `AGENTS.md`, or `.cursor/rules` required in their project.

## Two ways to connect

| Mode | Who | Setup |
|------|-----|--------|
| **Remote MCP (Pattern 3)** | Users without your repo | `url` + `Authorization: Bearer bs_live_…` → see [DISTRIBUTION.md](./DISTRIBUTION.md) |
| **Local stdio** | You / contributors with BlockSmith cloned | `npm run mcp` — below |

### Remote MCP (recommended for beta users)

```json
{
  "mcpServers": {
    "blocksmith": {
      "url": "https://your-blocksmith-host/api/mcp",
      "headers": {
        "Authorization": "Bearer bs_live_YOUR_API_KEY"
      }
    }
  }
}
```

Get an API key: `POST /api/v1/auth/keys` with `X-BlockSmith-Admin-Secret` (server admin).  
Or use `@block-smith/cli`: `blocksmith login --key … --url …` then `blocksmith mcp-url`.

---

## Prerequisites (local stdio)

1. `npm install` in the BlockSmith repo (or your project if BlockSmith runs against it).
2. **Either** paste/upload `.md` **or** scan a vendor workspace (see `scan_workspace` below).
3. Dev server run at least once **or** any MCP tool call (blocks are generated on first read).

## IDE-first ingest (vendor workspace)

Point MCP at the **vendor’s project** (their repo), not only BlockSmith:

```json
"env": {
  "BLOCKSMITH_WORKSPACE": "/absolute/path/to/vendor-app",
  "BLOCKSMITH_DOC": "upload:scan-vendor-app-abc12345.md"
}
```

Then call **`scan_workspace`** (MCP) or `npm run scan` (CLI). BlockSmith:

1. Reads real files under `src/components`, `src/app`, etc. (configurable via `BLOCKSMITH_SCAN_PATHS`)
2. Extracts CSS variables, hex colors, and React components from disk — **no mock values**
3. Writes `data/uploads/scan-<project>-<hash>.md` (stable per workspace path)
4. Refreshes wiki + blocks at `http://localhost:3000/wiki?doc=upload%3Ascan-…`

With `npm run dev`, saving UI files in `BLOCKSMITH_WORKSPACE` triggers a debounced rescan (disable with `BLOCKSMITH_SCAN_WATCH=0`).

## Cursor setup

1. Copy the example config:

   ```bash
   cp .cursor/mcp.json.example .cursor/mcp.json
   ```

2. Set env in `.cursor/mcp.json`:
   - `BLOCKSMITH_DOC` — active design file (e.g. `apollo.md` or `upload:design-xxxx.md`)
   - `BLOCKSMITH_AUTHOR` — your name (used by `log_component_work`)

3. Restart Cursor MCP (Settings → MCP → refresh).

4. With `npm run dev` running, save a `.md` file — wiki and MCP both see updated blocks.

## Claude / other MCP clients

Point the client at the same stdio command:

```json
{
  "command": "npm",
  "args": ["run", "mcp"],
  "cwd": "/path/to/BlockSmith",
  "env": {
    "BLOCKSMITH_DOC": "apollo.md",
    "BLOCKSMITH_AUTHOR": "your-name"
  }
}
```

On connect, the client receives **server instructions** describing the governed UI loop. No extra setup in the user's repo.

## Governed workflow (delivered by the connector)

For any task that adds or changes UI:

1. **`get_component_history`** — check if a teammate already fixed this component.
2. **`get_governance_rules`** or **`check_component_governance`** — load allowed tokens and do/don't rules.
3. **Build** using only defined tokens (`var(--color-…)`, `var(--wiki-…)`). No raw off-token hex.
4. **`validate_ui_code`** — lint generated code before applying; fix deviations and re-validate until governed.
5. **`log_component_work`** — record what changed so teammates see it in history.

Invoke the full loop from the connector UI via the **`governed_ui_task`** prompt (optional `task` and `component` arguments).

## Tools

| Tool | Purpose |
|------|---------|
| `scan_workspace` | Scan vendor repo → generate `.md` + refresh wiki (real file data only) |
| `get_design_tokens` | Colors, type, spacing, surfaces (`category` optional) |
| `get_component_docs` | Component specs by name (`names` array optional) |
| `list_components` | Discover component IDs |
| `get_sync_status` | Watcher + block index + content hash |
| `get_component_history` | Shared work log per component (or doc-wide feed) |
| `log_component_work` | Append to the activity ledger after UI changes (shown on wiki component pages) |
| `check_component_governance` | Pre-flight: spec + palette + do/don't + proposed color check |
| `get_governance_rules` | Whole-system rules in one call (palette, do/don't, component count) |
| `validate_ui_code` | Lint TSX/CSS for off-token colors before applying |

## Example prompts

- “Use BlockSmith `get_governance_rules`, then build a settings panel using only those tokens.”
- “Run the `governed_ui_task` prompt for updating the primary button.”
- “Call `get_component_history` for button before changing it — someone may have fixed it already.”
- “Validate this JSX with `validate_ui_code` before writing it to disk.”

## Commit-time enforcement (optional, local repo)

For teams that want push-time gates in addition to MCP:

```bash
git config core.hooksPath .githooks   # enables pre-commit color lint
npm run governance:check              # staged UI files only
npm run governance:check -- --all     # working tree
```

This scans **added lines** in `.ts/.tsx/.css` for off-token hex against `BLOCKSMITH_DOC`. It complements MCP; it does not replace connector instructions.

## Activity on the wiki (real data only)

Activity is **never seeded with mock users**. Entries come from:

1. **Git post-commit** — after a commit touching `.ts/.tsx/.css`, the hook matches changed files to components and logs with the real `git config user.name` + commit hash.
2. **MCP `log_component_work`** — agents/engineers log prompt + summary after a governed fix (author: git identity, then `BLOCKSMITH_AUTHOR`).

Each vendor/team uses their own `BLOCKSMITH_DOC` (e.g. `upload:design-abc.md`). Ledgers are isolated under `.blocksmith/activity/<doc>/`.

Enable hooks once per clone:

```bash
git config core.hooksPath .githooks
```

Wiki surfaces:

- **Component page** — `/wiki/components/{id}?doc=…`
- **Governance** — `/wiki/governance?doc=…`

## Verify the connector

```bash
npm run mcp:probe
BLOCKSMITH_DOC=upload:design-163e34fb.md npm run mcp:probe
```

Confirms: instructions on connect, 9 tools, `governed_ui_task` prompt, live rules, deviation detection.

## Run manually

```bash
npm run mcp
```

Uses stdio transport (Cursor/Claude spawn this process).

## Architecture

```
docs/designs.md/*.md  →  parser  →  .blocksmith/blocks/*.json
                              ↘
                    wiki UI     MCP tools (same JSON)
                                      ↓
                         server instructions + prompts
                         (governance — no repo files)
```

See [08-web-ide-handshake.md](./08-web-ide-handshake.md).
