import { notFound } from "next/navigation";
import { ComponentGallery } from "@blocksmith/pretext-components/react";
import {
  getDefaultDocFileName,
  loadDesignSystem,
  prepareDesignSystemDoc,
} from "@/lib/clients/registry";
import { resolveDocParam } from "@/lib/wiki/doc-param";
import { ensureDesignIRWithFonts } from "@/lib/design-ir/ensure";
import { buildComponentGallery } from "@/lib/pretext-components/adapter";
import { StudioShell } from "@/components/studio/StudioShell";
import { IRWikiChromeStyles } from "@/components/wiki/IRWikiChromeStyles";
import { WikiFontFaces } from "@/components/wiki/WikiFontFaces";
import { GoogleFontsLink } from "@/components/wiki/GoogleFontsLink";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ doc?: string }>;
};

export default async function StudioPage({ searchParams }: PageProps) {
  const { doc: docParam } = await searchParams;

  let fileName: string;
  try {
    fileName = resolveDocParam(docParam) ?? getDefaultDocFileName();
  } catch {
    notFound();
  }

  let system;
  try {
    await prepareDesignSystemDoc(fileName);
    system = loadDesignSystem(fileName);
  } catch {
    notFound();
  }

  const ir = await ensureDesignIRWithFonts(fileName, system);
  const gallery = buildComponentGallery(ir, system);

  return (
    <>
      {system.colors.length > 0 || system.typography.length > 0 ? (
        <>
          <WikiFontFaces
            typography={system.typography}
            fontResolutions={ir.fontResolutions}
          />
          <IRWikiChromeStyles ir={ir} />
          <GoogleFontsLink
            typography={system.typography}
            fontResolutions={ir.fontResolutions}
          />
        </>
      ) : null}
      <StudioShell systemName={system.name} docFileName={fileName}>
        <p className="mb-10 max-w-2xl text-sm text-[var(--wiki-muted)]">
          Component frames laid out with{" "}
          <a
            href="https://github.com/chenglou/pretext"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            Pretext
          </a>{" "}
          — canvas-accurate text measurement for buttons, cards, nav, inputs, and
          more. Separate from AI Lab; driven by your parsed design IR.
        </p>
        <ComponentGallery composition={gallery} />
      </StudioShell>
    </>
  );
}
