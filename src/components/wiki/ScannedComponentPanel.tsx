import type { ComponentDoc } from "@/lib/blocks/types";

export function ScannedComponentPanel({
  component,
  sourceExcerpt,
}: {
  component: ComponentDoc;
  sourceExcerpt?: string | null;
}) {
  const scan = component.scan;
  if (!scan) return null;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
          Source
        </h2>
        <p className="mt-2 font-mono text-sm text-[var(--wiki-text)]">{scan.sourceFile}</p>
        {scan.exports.length > 0 ? (
          <p className="mt-2 text-sm text-[var(--wiki-muted)]">
            Exports:{" "}
            {scan.exports.map((e) => (
              <code
                key={e}
                className="mr-2 rounded bg-[var(--wiki-active)] px-1.5 py-0.5 text-xs text-[var(--wiki-text)]"
              >
                {e}
              </code>
            ))}
          </p>
        ) : null}
      </section>

      {scan.interface ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            Props &amp; variants
          </h2>
          <p className="mt-2 text-xs text-[var(--wiki-muted)]">
            From the component&apos;s real type signature — generated into{" "}
            <code className="font-mono">@blocksmith/&lt;product&gt;</code>.
          </p>
          {scan.interface.props.length > 0 ? (
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--wiki-muted)]">
                  <th className="border-b border-[var(--wiki-border)] py-2 pr-4 font-medium">
                    Prop
                  </th>
                  <th className="border-b border-[var(--wiki-border)] py-2 pr-4 font-medium">
                    Type
                  </th>
                  <th className="border-b border-[var(--wiki-border)] py-2 font-medium">
                    Default
                  </th>
                </tr>
              </thead>
              <tbody>
                {scan.interface.props.map((p) => (
                  <tr key={p.name} className="align-top">
                    <td className="border-b border-[var(--wiki-border)] py-2 pr-4">
                      <code className="font-mono text-[var(--wiki-text)]">
                        {p.name}
                      </code>
                      {!p.optional ? (
                        <span className="ml-2 rounded bg-[var(--wiki-active)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--wiki-muted)]">
                          required
                        </span>
                      ) : null}
                    </td>
                    <td className="border-b border-[var(--wiki-border)] py-2 pr-4">
                      {p.variants ? (
                        <span className="flex flex-wrap gap-1">
                          {p.variants.map((v) => (
                            <code
                              key={v}
                              className="rounded-md border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-1.5 py-0.5 font-mono text-xs text-[var(--wiki-text)]"
                            >
                              {v}
                            </code>
                          ))}
                        </span>
                      ) : (
                        <code className="font-mono text-xs text-[var(--wiki-muted)]">
                          {p.type}
                        </code>
                      )}
                    </td>
                    <td className="border-b border-[var(--wiki-border)] py-2 font-mono text-xs text-[var(--wiki-muted)]">
                      {p.default ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-3 text-sm text-[var(--wiki-muted)]">
              No public props{scan.interface.hasChildren ? " besides children" : ""}.
            </p>
          )}
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--wiki-muted)]">
            {scan.interface.hasChildren ? <span>Accepts children</span> : null}
            {scan.interface.rootElement ? (
              <span>
                Root element:{" "}
                <code className="font-mono">&lt;{scan.interface.rootElement}&gt;</code>
              </span>
            ) : null}
            {scan.interface.extendsTypes.length > 0 ? (
              <span>
                Extends:{" "}
                {scan.interface.extendsTypes.map((e) => (
                  <code key={e} className="mr-1 font-mono">
                    {e}
                  </code>
                ))}
              </span>
            ) : null}
          </p>
        </section>
      ) : null}

      {scan.cssVarsUsed.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            CSS variables used
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {scan.cssVarsUsed.map((v) => (
              <li
                key={v}
                className="rounded-md border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] px-2 py-1 font-mono text-xs text-[var(--wiki-text)]"
              >
                {v}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {scan.colorsUsed.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            Hex colors in this file
          </h2>
          <p className="mt-2 text-xs text-[var(--wiki-muted)]">
            Raw values on disk — prefer design tokens.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {scan.colorsUsed.map((hex) => (
              <li
                key={hex}
                className="flex items-center gap-2 rounded-md border border-[var(--wiki-border)] px-2 py-1 text-xs"
              >
                <span
                  className="h-4 w-4 rounded border border-[var(--wiki-border)]"
                  style={{ backgroundColor: hex }}
                />
                <code>{hex}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sourceExcerpt ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            Source excerpt
          </h2>
          <pre className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-[var(--wiki-border)] bg-[var(--wiki-sidebar)] p-4 font-mono text-xs leading-relaxed text-[var(--wiki-text)]">
            {sourceExcerpt}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
