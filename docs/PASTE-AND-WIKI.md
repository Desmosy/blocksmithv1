# Paste & generate wiki

**Home:** [http://localhost:3000/](http://localhost:3000/) — Meta-style studio for any `.md` design doc.

## How it works

1. **Paste** markdown in the text area, or **drop / upload** one or many `.md` files.
2. Click **↑** (or upload a single file to auto-redirect).
3. BlockSmith saves to `data/uploads/` and opens the wiki with `?doc=upload:your-file-{hash}.md`.
4. **Parser auto-detect:**
   - **Apollo** — structured tokens (`## Tokens — Colors`, component tables) → full visual wiki.
   - **Generic** — any doc with `##` / `###` headings → section sidebar + rendered markdown pages.

## Bulk testing (100+ design .md files)

1. On the home page, use **+** or drag a folder of `.md` files (multi-select).
2. Each file becomes its own wiki; results list appears with **Open wiki →** per file.
3. Uploaded docs also show under **Recent uploads**.

## Repo docs (unchanged)

Files in `docs/designs.md/` still load via **Design doc** dropdown (e.g. `apollo.md`).

## API

```bash
# Paste
curl -X POST http://localhost:3000/api/wiki/import \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"# My System\n\n## Colors\n..."}'

# File
curl -X POST http://localhost:3000/api/wiki/import \
  -F "file=@./my-design.md"
```

Response includes `wikiUrl` and `parser` (`apollo` | `generic`).
