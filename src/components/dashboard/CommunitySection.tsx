import Link from "next/link";
import { listPublishedDocuments } from "@/lib/cloud/documents";
import { saasDbEnabled } from "@/lib/cloud/saas";
import {
  loadDesignSystem,
  prepareDesignSystemDoc,
} from "@/lib/clients/registry";
import { hrefWithDoc } from "@/lib/wiki/doc-param";

type CommunityCard = {
  docRef: string;
  name: string;
  tagline: string;
  colors: number;
  components: number;
};

/**
 * Design systems their owners chose to share — the template shelf.
 *
 * Everything here traces to a signed-in admin who flipped the publish
 * toggle on a system they own; nothing arrives anonymously, and an owner
 * can withdraw a system at any time by unpublishing it. That standing
 * accountability is the difference between a community section and an
 * unauthenticated write path into every visitor's dashboard.
 */
export async function CommunitySection() {
  if (!saasDbEnabled()) return null;

  let cards: CommunityCard[] = [];
  try {
    const docs = await listPublishedDocuments(12);
    cards = (
      await Promise.all(
        docs.map(async (d): Promise<CommunityCard | null> => {
          try {
            await prepareDesignSystemDoc(d.docRef);
            const system = loadDesignSystem(d.docRef);
            return {
              docRef: d.docRef,
              name: system.name,
              tagline: system.tagline || "A published design system",
              colors: system.colors.length,
              components: system.components.length,
            };
          } catch {
            // A published doc that will not load is skipped, not guessed at.
            return null;
          }
        }),
      )
    ).filter((c): c is CommunityCard => c !== null);
  } catch {
    return null;
  }

  if (!cards.length) return null;

  return (
    <section className="px-2 pb-10">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-gtstandardmono text-[12px] uppercase tracking-wider text-graphite">
          Community
        </h2>
        <span className="text-[13px] text-graphite/70">
          published by their owners · use as templates
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.docRef}
            href={hrefWithDoc("/wiki", c.docRef)}
            className="group rounded-xl border border-[var(--dash-border,#e5e7eb)] bg-[var(--dash-surface,#fff)] p-4 transition hover:border-[var(--dash-foreground,#111)]/30"
          >
            <p className="text-[15px] font-semibold text-[var(--dash-foreground,#111)]">
              {c.name}
            </p>
            <p className="mt-1 line-clamp-2 text-[13px] text-[var(--dash-muted-fg,#6b7280)]">
              {c.tagline}
            </p>
            <p className="mt-3 text-[12px] text-[var(--dash-muted-fg,#6b7280)]">
              {c.colors} tokens · {c.components} components
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
