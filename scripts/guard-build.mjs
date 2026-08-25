#!/usr/bin/env node
/**
 * Refuse production builds while `next dev` is running — that corrupts .next
 * and causes Internal Server Error / missing chunk errors in the browser.
 * Skipped on CI/Vercel (pgrep can false-positive on build machines).
 */
import { execSync } from "node:child_process";

if (process.env.VERCEL === "1" || process.env.CI === "true") {
  process.exit(0);
}

try {
  const running = execSync("pgrep -fl 'next dev' 2>/dev/null || true", {
    encoding: "utf8",
  }).trim();
  if (running) {
    console.error(
      "\n[build] Stop the dev server first (`Ctrl+C` or close the terminal running npm run dev).\n" +
        "        Building while `next dev` is active often corrupts .next and breaks localhost:3000.\n" +
        "        Then run: npm run build\n",
    );
    process.exit(1);
  }
} catch {
  /* pgrep missing — allow build */
}
