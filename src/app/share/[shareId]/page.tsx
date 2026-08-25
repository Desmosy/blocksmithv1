import { notFound } from "next/navigation";
import { getShare } from "@/lib/public-share/store";
import { loadPublicBlock } from "@/lib/public-share/load-block";
import { loadDesignSystem } from "@/lib/clients/registry";
import { PublicBlockPreview } from "@/components/share/PublicBlockPreview";
import { OpinionPanel } from "@/components/share/OpinionPanel";
import { ApolloThemeStyles } from "@/components/wiki/ApolloThemeStyles";
import { GoogleFontsLink } from "@/components/wiki/GoogleFontsLink";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ shareId: string }> };

export default async function PublicSharePage({ params }: PageProps) {
  const { shareId } = await params;
  const share = await getShare(shareId);
  if (!share || !share.enabled) notFound();

  let system;
  try {
    system = loadDesignSystem(share.docFileName);
  } catch {
    notFound();
  }

  const block = loadPublicBlock(share);
  if (!block) notFound();

  const versionNote =
    share.contentHash &&
    block.kind === "component" &&
    system.contentHash &&
    share.contentHash !== system.contentHash
      ? "This preview was shared from an earlier doc version."
      : null;

  return (
    <>
      {system.mode !== "generic" ? (
        <>
          <ApolloThemeStyles system={system} />
          <GoogleFontsLink typography={system.typography} />
        </>
      ) : null}

      <article>
        <p className="text-xs font-medium text-[var(--wiki-muted)]">
          {share.systemName} · {share.blockKind}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {share.blockTitle}
        </h1>
        {versionNote ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            {versionNote}
          </p>
        ) : null}

        <div className="design-preview apollo-preview mt-8">
          <PublicBlockPreview block={block} system={system} />
        </div>

        <OpinionPanel shareId={share.id} initialStats={share.stats} />
      </article>
    </>
  );
}
