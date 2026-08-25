# @blocksmith/sdk

HTTP client for hosted BlockSmith (scans, pull, MCP-backed workflows).

## Install

```bash
npm install @blocksmith/sdk
```

## Usage

```typescript
import { createClient } from "@blocksmith/sdk";

const client = createClient({
  baseUrl: "https://your-app.vercel.app",
  apiKey: "bs_live_…",
});

const me = await client.me();
const pull = await client.scans.pull({ docRef: "upload:scan-your-kit.md" });
```

## Publish (maintainers)

From repo root:

```bash
npm run build:sdk
npm publish -w @blocksmith/sdk --access public
```

See [docs/NPM-PUBLISH.md](../../docs/NPM-PUBLISH.md).
