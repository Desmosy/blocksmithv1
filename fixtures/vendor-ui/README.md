# vendor-ui fixture

Minimal vendor-shaped repo for BlockSmith software verification.

- `src/components/ui/` — design primitives (featured in wiki)
- `src/components/layout/` — app chrome (inventoried, not featured)
- `src/app/globals.css` — token source

Fast in-memory check:

```bash
npm run verify:vendor-fixture
```

Full persist + wiki parse (core goal #1):

```bash
npm run verify:vendor-e2e
```

Scan into `data/uploads/` and open wiki:

```bash
npm run scan:vendor
```

Real external repo (from BlockSmith root):

```bash
BLOCKSMITH_WORKSPACE=/absolute/path/to/vendor-app AI_LAB_SCAN_CURATE=0 npm run scan
BLOCKSMITH_WORKSPACE=/absolute/path/to/vendor-app npm run verify:vendor-e2e
```
