# Step 05 — Font resolve (parser model)

Maps proprietary typefaces (Soehne, Season Mix, etc.) to the closest **Google Font** from a curated catalog.

- **Model:** `NVIDIA_MODEL_PARSER` (GPT-OSS) — not Nemotron
- **Cache:** `fontResolutions` on Design IR (`.blocksmith/design/{doc}/ir.json`)
- **Disable:** `AI_LAB_FONT_RESOLVE=0` in `.env.local`

```bash
npm run ai-lab:fonts -- upload:design-5852ccbe.md
```
