# Visualize style (hybrid — semantic + optional AI refine)

**Default:** wiki chrome applies **instantly** from scan/design IR (semantic compiler). A **background** LLM pass may refine chrome; failures keep the semantic preview.


---

## Pipeline (on **Visualize style** click)

1. **Immediate** — semantic IR → `--wiki-*` chrome (fonts, colors, surfaces from scan).
2. **Background** (if `NVIDIA_API_KEY` set) — single fast LLM refine via `POST /api/ai/layout`.
3. **Optional ensemble** — set `NVIDIA_ENSEMBLE=1` on server for multi-agent mode (slow; not default).

Color swatches on Foundation pages always show exact hex from your doc.

---

## Server requirement

`NVIDIA_API_KEY` on the server enables **AI refine** (optional polish). Visualize works **without** it using semantic chrome only.

```bash
NVIDIA_API_KEY=nvapi-...
NVIDIA_API_KEY_FALLBACK=nvapi-...   # optional
AI_LAB_SCAN_CURATE=0                # separate feature; keep 0 on Vercel
NVIDIA_ENSEMBLE=0                   # default; 1 = slow multi-agent path
```

Check: `GET /api/ai/status` → `{ "configured": true, "visualizeMode": "hybrid" }`.

---

## Timing

- Semantic preview: **&lt; 1s**
- AI refine: typically **30–90s**; timeout shows a soft warning, preview unchanged

---

## API

- `GET /api/ai/status` — AI Lab configured? visualize mode?
- `POST /api/ai/layout` — background refine; body `{ "doc": "upload:scan-….md" }`
- `GET /api/design-system?doc=…` — Design IR (tokens)

---

## Local dev

```bash
cp .env.example .env.local
# Add NVIDIA_API_KEY (optional for semantic-only)
npm run dev:clean
```

See [VISUALIZE-ACCURACY-PLAN.md](./VISUALIZE-ACCURACY-PLAN.md) for architecture history.
