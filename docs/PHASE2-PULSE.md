# Phase 2 — `@blocksmith/pulse` (design-as-import)


Pulse is the **`pulse-react` compile target** from Design IR — one scan doc → `@blocksmith/<slug>` per team/product.

**Status:** v0 implemented locally — `npm run codegen:pulse` / `npm run verify:pulse`. Auto-on-scan + hosted demo ⬜.

**Vision:** Compile scan/wiki `.md` → generated package so engineers and agents **import** design truth instead of hand-written CSS.

```tsx
import { Surface, Text, Button } from "@blocksmith/acme-ui-kit";

<Surface level={1}>
  <Text variant="heading">Hello</Text>
  <Button variant="primary">Save</Button>
</Surface>
```

---

## Why now (even though deploy isn’t done)

| Software layer | Status |
|----------------|--------|
| Scan → `.md` → wiki (Goal 1) | ✅ local |
| Handshake Goals 2–4 | ✅ verify scripts |
| Supabase + Patterns 2–4 | ✅ local |
| **Public internet** | ⬜ [DEPLOY.md](./DEPLOY.md) |

Phase 2 does **not** require Vercel. It turns existing scan markdown into importable React — new value without shipping.

---

## v0 scope (smallest useful package)

**Input:** `upload:scan-acme-ui-kit.md` (or any workspace-scan doc)

**Output:** `packages/generated/<slug>/` (e.g. `@blocksmith/acme-ui-kit`)

| Export | Source in scan `.md` |
|--------|----------------------|
| `colors` | CSS vars + hex from scan |
| `Text` | typography tokens |
| `Surface` | surface levels / spacing |
| `Button` | featured `Button` component spec |

**Non-goals for v0:**

- Full component parity with vendor repo
- Real firmware (device = **simulator / second compile target** later)
- Replacing vendor’s real `Button.tsx` — **governed stubs** from wiki truth
- Public npm publish of every customer package (deferred)

### Who gets a package?

| Trigger | Package |
|---------|---------|
| Engineer scans `acme/app` | `@blocksmith/acme-app` (slug from `workspaceId` or repo) |
| Re-scan / finalize | Same slug, regenerated from updated `.md` |
| Owner | Team org + user in `blocksmith_documents` |

---

## Pipeline (v0)

```
scan .md  →  parseWorkspaceScanMarkdown()  →  src/lib/codegen/pulse.ts  →  packages/generated/<slug>/  →  tsc
```

| Piece | Path |
|-------|------|
| Codegen core | `src/lib/codegen/pulse.ts` |
| CLI script | `scripts/codegen-pulse.ts` |
| Verify | `scripts/verify-pulse.ts` |
| Shared primitives | `packages/pulse-runtime/` (`Surface`, `Text`) |
| Generated output | `packages/generated/acme-ui-kit/` (gitignored; rebuilt by verify) |

```bash
npm run codegen:pulse
# BLOCKSMITH_DOC=upload:scan-acme-ui-kit.md npm run codegen:pulse
npm run verify:pulse
```

---

## Build order (Phase 2)

1. **Token export** — `colors.ts` + `cssVars.ts` from scan parse
2. **Primitive components** — `Surface`, `Text` with CSS var refs only
3. **One real primitive** — `Button` from scan `button` featured entry
4. ✅ **CLI** — `blocksmith codegen [--doc upload:scan-acme-ui-kit.md]`
5. ✅ **Demo** — `/demo/pulse` in the Next app
6. ✅ **API** — `POST /api/v1/codegen/pulse` (SDK `client.codegen.pulse()`)
7. ✅ **MCP** — `pulse_codegen` tool

---

## Success criteria (v0 done)

```bash
npm run codegen:pulse          # reads BLOCKSMITH_DOC
npm run verify:pulse           # generated package typechecks + renders Button
```

Demo: `http://localhost:3000/demo/pulse` imports `@blocksmith/acme-ui-kit`.

---

## Next (investor prototype)

1. Auto `runPulseCodegen` after scan/upload
2. `/demo/pulse?doc=upload:scan-….md` for **that** product
3. Side-by-side **device frame** (same IR, web + watch preview)

---

## Related

- [GOAL1-VENDOR-SCAN.md](./GOAL1-VENDOR-SCAN.md)
- [DEPLOY.md](./DEPLOY.md)
