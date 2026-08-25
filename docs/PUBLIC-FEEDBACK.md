# Public block feedback

Pre-launch human signal on a **single design block** — not the whole app.

## Flow

1. In the wiki, open a **component** or **surface** page.
2. Under **Public feedback**, click **Get public link**.
3. Send the URL to anyone (teammates, beta users, social test).
4. They see the live preview and pick: **Works for me** · **Not sure** · **Doesn’t work**.
5. Views and reactions appear in the wiki panel (**Refresh stats**).

## URLs

| Surface | Example |
|---------|---------|
| Public preview | `http://localhost:3000/share/{shareId}` |
| Wiki (private) | `http://localhost:3000/wiki/components/{id}?doc=apollo.md` |

One share record per `(doc, blockKind, blockId)`. Re-opening **Get public link** returns the same URL.

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/share` | Create share `{ docFileName, blockKind, blockId }` |
| `GET` | `/api/share?doc=&blockKind=&blockId=` | Lookup existing share |
| `GET` | `/api/share/{id}` | Share metadata + stats |
| `POST` | `/api/share/{id}/view` | Increment view count |
| `POST` | `/api/share/{id}/opinion` | `{ reaction: approve \| unsure \| reject }` |

## Storage

JSON files in `data/public-share/{shareId}.json` (gitignored). Fine for local demos; swap for Postgres/Redis when you deploy.

## Block kinds

| `blockKind` | `blockId` example |
|-------------|-------------------|
| `component` | `primary-action-button` (component slug) |
| `surface` | `level-1-canvas` |
| `color` | `color-canvas` (CSS var without `--`) |

Color shares are supported by the API; wire UI on the Color page when needed.

## Troubleshooting

**“Internal Server Error” on `/share/...`**

Usually a stale Next.js cache (same as wiki `Cannot find module './331.js'`). Stop the dev server, then:

```bash
npm run dev:clean
```

Reload the share URL. The API (`GET /api/share/{id}`) may still work while the page route fails until you clean `.next`.

## Env

Optional production base URL:

```bash
NEXT_PUBLIC_APP_URL=https://your-lab.example.com
```

Used when generating copy-paste links from the server.

## Thesis

See [00-thesis.md](./00-thesis.md) — **Blocks can go public**.
