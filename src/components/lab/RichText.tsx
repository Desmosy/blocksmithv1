"use client";

/**
 * Renders the small amount of markup the governance engine emits — `**bold**`
 * and `` `code` `` — as real elements.
 *
 * The engine writes for an agent, which reads markdown fine. The same strings
 * are shown to the human, and raw asterisks on screen read as a bug.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <code key={i} className="lab-code">
              {p.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
