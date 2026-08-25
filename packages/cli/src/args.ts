/**
 * Tiny zero-dependency argv parser.
 *
 * Supports `--flag value`, `--flag=value`, boolean `--flag`, short `-h`/`-v`,
 * and positional arguments. The first non-flag token is treated as the command.
 * Keeping this in-house avoids a runtime dependency in a globally-installed CLI.
 */
export type FlagValue = string | boolean;
export type Flags = Record<string, FlagValue>;

export interface ParsedArgs {
  /** First non-flag token, e.g. "pull". Empty string when only flags were given. */
  command: string;
  /** Positional args after the command. */
  positionals: string[];
  flags: Flags;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Flags = {};
  const positionals: string[] = [];
  let command = "";
  let i = 0;

  // Command = first token that isn't a flag.
  if (argv.length > 0 && !argv[0].startsWith("-")) {
    command = argv[0];
    i = 1;
  }

  for (; i < argv.length; i++) {
    const tok = argv[i];

    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      if (eq >= 0) {
        flags[tok.slice(2, eq)] = tok.slice(eq + 1);
        continue;
      }
      const name = tok.slice(2);
      const next = argv[i + 1];
      // A following non-flag token is this flag's value; otherwise it's boolean.
      if (next !== undefined && !next.startsWith("-")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else if (tok.startsWith("-") && tok.length > 1) {
      // Short boolean flags (-h, -v). Each letter becomes its own boolean.
      for (const ch of tok.slice(1)) flags[ch] = true;
    } else {
      positionals.push(tok);
    }
  }

  return { command, positionals, flags };
}

/** First string-valued flag among `names`, or undefined (ignores boolean flags). */
export function flagStr(flags: Flags, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = flags[n];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

/** True if any of `names` is present (as boolean or string). */
export function flagBool(flags: Flags, ...names: string[]): boolean {
  return names.some((n) => flags[n] !== undefined);
}
