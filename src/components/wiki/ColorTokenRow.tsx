import type { ColorToken } from "@/lib/blocks/types";

interface ColorTokenRowProps {
  token: ColorToken;
  highContrast?: boolean;
}

export function ColorTokenRow({ token, highContrast }: ColorTokenRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,200px)_1fr] items-center gap-6 border-b border-[var(--wiki-border)] py-4 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 shrink-0 rounded-md"
          style={{
            backgroundColor: token.value,
            border: "var(--wiki-card-border, none)",
            boxShadow: "var(--wiki-card-shadow, none)",
            borderRadius: "var(--wiki-radius, 8px)",
          }}
          aria-hidden
        />
        <div>
          <p className="font-mono text-sm font-medium text-[var(--wiki-text)]">
            {token.cssVar.replace("--color-", "")}
          </p>
          <p className="font-mono text-xs text-[var(--wiki-muted)]">{token.value}</p>
        </div>
      </div>
      <p
        className={`text-sm leading-relaxed ${
          highContrast ? "text-[var(--wiki-text)]" : "text-[var(--wiki-muted)]"
        }`}
      >
        {token.role}
      </p>
    </div>
  );
}
