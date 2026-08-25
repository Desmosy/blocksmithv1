import Link from "next/link";
import type { MarkdownSection } from "@/lib/parser/generic";
import type { DocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { MarkdownBody } from "../MarkdownBody";
import { SectionEditor } from "../SectionEditor";

export function GenericSectionPage({
  section,
  children,
  docFileName,
  lifecycle = "preview",
}: {
  section: MarkdownSection;
  children?: MarkdownSection[];
  docFileName?: string;
  lifecycle?: DocLifecycle;
}) {
  const docQuery = docFileName
    ? `?doc=${encodeURIComponent(docFileName)}`
    : "";

  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-tight">{section.title}</h1>
      {docFileName ? (
        <div className="mt-4">
          <SectionEditor
            docFileName={docFileName}
            sectionHeading={section.title}
            lifecycle={lifecycle}
          />
        </div>
      ) : null}
      <div className="mt-8">
        <MarkdownBody content={section.content} />
      </div>
      {children && children.length > 0 ? (
        <nav className="mt-10 border-t border-[var(--wiki-border)] pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--wiki-muted)]">
            In this section
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/wiki/doc/${child.id}${docQuery}`}
                  className="text-sm font-medium text-[var(--wiki-text)] hover:text-[var(--wiki-accent)]"
                >
                  {child.title} →
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
