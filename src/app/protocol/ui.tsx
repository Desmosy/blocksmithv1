import type { ReactNode } from "react";

/** Shared primitives for the /protocol spec site (server components). */

export function H1({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <header className="mb-8">
      {kicker && (
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d97757]">
          {kicker}
        </p>
      )}
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{children}</h1>
    </header>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 text-lg font-semibold tracking-tight">{children}</h2>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 max-w-2xl text-[15px] leading-relaxed text-[#b9b9c0]">{children}</p>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[0.9em] text-[#e7e7ea]">
      {children}
    </code>
  );
}

export function Pre({ children, title }: { children: string; title?: string }) {
  return (
    <figure className="mb-6">
      {title && (
        <figcaption className="rounded-t-lg border border-b-0 border-white/10 bg-white/5 px-4 py-2 font-mono text-[11px] text-[#8a8a92]">
          {title}
        </figcaption>
      )}
      <pre
        className={`overflow-x-auto border border-white/10 bg-[#111116] p-4 font-mono text-[12.5px] leading-relaxed text-[#d6d6dc] ${title ? "rounded-b-lg" : "rounded-lg"}`}
      >
        {children}
      </pre>
    </figure>
  );
}

export function Table({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="mb-6 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-[#8a8a92]">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-t border-white/8">
              {cells.map((c, j) => (
                <td key={j} className="px-4 py-2.5 align-top text-[#c9c9d0]">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border border-[#d97757]/40 bg-[#d97757]/8 px-4 py-3 text-[14px] leading-relaxed text-[#e7c9bc]">
      {children}
    </div>
  );
}
