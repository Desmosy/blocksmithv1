/**
 * Single source of truth for schemas: packages/protocol/schemas/ → public/schema/.
 * The drift gate (protocol:conformance) fails CI if the copies differ.
 */
import { copyFileSync, readdirSync } from "fs";
import { join } from "path";

const SRC = join(process.cwd(), "packages", "protocol", "schemas");
const DEST = join(process.cwd(), "public", "schema");

for (const name of readdirSync(SRC)) {
  if (!name.endsWith(".json")) continue;
  copyFileSync(join(SRC, name), join(DEST, name));
  console.log(`synced ${name}`);
}
