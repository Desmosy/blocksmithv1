import { listPublishedDocuments } from "@/lib/cloud/documents";
import { saasDbEnabled } from "@/lib/cloud/saas";
import {
  loadDesignSystem,
  prepareDesignSystemDoc,
} from "@/lib/clients/registry";
import { CommunityCard } from "./ProjectGrid";

type CommunityEntry = {
  docRef: string;
  name: string;
  tagline: string;
  updatedAt: string | null;
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

  let cards: CommunityEntry[] = [];
  try {
    const docs = await listPublishedDocuments(12);
    cards = (
      await Promise.all(
        docs.map(async (d): Promise<CommunityEntry | null> => {
          try {
            await prepareDesignSystemDoc(d.docRef);
            const system = loadDesignSystem(d.docRef);
            return {
              docRef: d.docRef,
              name: system.name,
              tagline: system.tagline || "A published design system",
              updatedAt: d.updatedAt ?? null,
              colors: system.colors.length,
              components: system.components.length,
            };
          } catch {
            // A published doc that will not load is skipped, not guessed at.
            return null;
          }
        }),
      )
    ).filter((c): c is CommunityEntry => c !== null);
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <CommunityCard
            key={c.docRef}
            docRef={c.docRef}
            name={c.name}
            tagline={c.tagline}
            updatedAt={c.updatedAt}
            tokens={c.colors}
            components={c.components}
          />
        ))}
      </div>
    </section>
  );
}
