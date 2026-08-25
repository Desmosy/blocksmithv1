# npm publish — CLI & SDK

When ready to ship `@block-smith/cli` and `@blocksmith/sdk` (no monorepo `file:` deps).

---

## 1. Publish SDK first

```bash
cd packages/sdk
npm run build
npm publish --access public   # or restricted for private npm org
```

## 2. Publish both (from repo root)

```bash
npm run publish:packages:dry-run   # optional rehearsal
npm run publish:packages
```

This publishes SDK first, temporarily sets CLI's `@blocksmith/sdk` to `^0.1.0` for the tarball, then restores `file:../sdk` for local dev.

## 3. User install

```bash
npm install -g @block-smith/cli
blocksmith login --key bs_live_... --url https://your-app.vercel.app
blocksmith pull --doc upload:scan-your-kit.md
```

---

## Before first publish

- [ ] Choose npm org scope (`@blocksmith` on npmjs.com)
- [ ] Change `license` from `UNLICENSED` if open-sourcing
- [ ] Add `repository` + `homepage` fields in package.json
- [ ] CI: `npm run build:packages` on release tag

Deploy and GitHub OAuth can wait until after publish if friends install via npm + your API URL.
