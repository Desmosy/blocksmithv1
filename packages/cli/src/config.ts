import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export type CliConfig = {
  apiKey: string;
  baseUrl: string;
};

const CONFIG_DIR = join(homedir(), ".blocksmith");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function loadConfig(): CliConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as CliConfig;
    if (raw?.apiKey?.trim() && raw?.baseUrl?.trim()) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveConfig(config: CliConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

export function configPath(): string {
  return CONFIG_PATH;
}
