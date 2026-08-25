import Link from "next/link";
import { hrefWithDoc } from "@/lib/wiki/doc-param";

export function GenericModeNotice({
  route,
  fileName,
}: {
  route: string;
  fileName: string;
}) {
  return (
    <article className="max-w-lg">
      <h1 className="text-2xl font-semibold">Page not in this document</h1>
      <p className="mt-4 text-sm text-[var(--wiki-muted)]">
        <code className="font-mono">{route}</code> is part of the structured
        Apollo wiki. The current file{" "}
        <code className="font-mono">{fileName}</code> uses generic markdown
        mode — open sections from the sidebar under Document.
      </p>
      <Link
        href={hrefWithDoc("/wiki", fileName)}
        className="mt-6 inline-block text-sm font-medium underline"
      >
        Back to introduction
      </Link>
    </article>
  );
}
