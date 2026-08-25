import rehypeShiki from "@shikijs/rehype";
import { MarkdownAsync } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Safe GFM rendering for generic docs. Raw HTML is intentionally not enabled. */
export async function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="prose-wiki space-y-4 text-sm leading-relaxed text-[var(--wiki-muted)]">
      <MarkdownAsync
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [
            rehypeShiki,
            {
              themes: {
                light: "github-light-default",
                dark: "github-dark-default",
              },
            },
          ],
        ]}
        components={{
        h1: ({ children }) => (
          <h1 className="mt-10 text-2xl font-semibold text-[var(--wiki-text)]">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-9 text-xl font-semibold text-[var(--wiki-text)]">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-8 text-base font-semibold text-[var(--wiki-text)]">{children}</h3>
        ),
        a: ({ children, ...props }) => (
          <a {...props} className="font-medium text-[var(--wiki-accent)] underline underline-offset-2">
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="list-disc space-y-2 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5">{children}</ol>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[var(--wiki-accent)] pl-4 italic">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto rounded-lg border border-[var(--wiki-border)]">
            <table className="w-full text-left text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-[var(--wiki-sidebar)]">{children}</thead>,
        tr: ({ children }) => (
          <tr className="border-b border-[var(--wiki-border)] last:border-0">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 font-medium text-[var(--wiki-text)]">{children}</th>
        ),
        td: ({ children }) => <td className="px-4 py-2">{children}</td>,
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-lg border border-[var(--wiki-border)] p-4 text-xs">
            {children}
          </pre>
        ),
        code: ({ className, children, ...props }) => (
          <code
            {...props}
            className={
              className ??
              "rounded bg-[var(--wiki-active)] px-1 py-0.5 font-mono text-xs text-[var(--wiki-text)]"
            }
          >
            {children}
          </code>
        ),
        }}
      >
        {content}
      </MarkdownAsync>
    </div>
  );
}
