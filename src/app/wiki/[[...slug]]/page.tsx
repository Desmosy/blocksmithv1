import { notFound } from "next/navigation";
import {
  getDefaultDocFileName,
  getClientMeta,
  loadDesignSystem,
  prepareDesignSystemDoc,
} from "@/lib/clients/registry";
import { listAccessibleDocSources } from "@/lib/cloud/doc-visibility";
import { assertWikiDocAccess } from "@/lib/cloud/wiki-access";
import { resolveDocParam } from "@/lib/wiki/doc-param";
import { WikiShell } from "@/components/wiki/WikiShell";
import { IntroductionPage } from "@/components/wiki/pages/IntroductionPage";
import { ColorPage } from "@/components/wiki/pages/ColorPage";
import { TypographyPage } from "@/components/wiki/pages/TypographyPage";
import { SpacingPage } from "@/components/wiki/pages/SpacingPage";
import { ButtonsPage } from "@/components/wiki/pages/ButtonsPage";
import { GuidelinesPage } from "@/components/wiki/pages/GuidelinesPage";
import { SourcePage } from "@/components/wiki/pages/SourcePage";
import { SurfacesPage } from "@/components/wiki/pages/SurfacesPage";
import { LayoutPage } from "@/components/wiki/pages/LayoutPage";
import { ImageryPage } from "@/components/wiki/pages/ImageryPage";
import { AgentGuidePage } from "@/components/wiki/pages/AgentGuidePage";
import { SyncPage } from "@/components/wiki/pages/SyncPage";
import { ReleasesPage } from "@/components/wiki/pages/ReleasesPage";
import { PipelinePage } from "@/components/wiki/pages/PipelinePage";
import { PreviewPipelineEmptyState } from "@/components/wiki/pages/PreviewPipelineEmptyState";
import { ComponentDetailPage } from "@/components/wiki/pages/ComponentDetailPage";
import { ComponentPlaygroundPage } from "@/components/wiki/pages/ComponentPlaygroundPage";
import { DemoPage } from "@/components/wiki/pages/DemoPage";
import { GovernancePage } from "@/components/wiki/pages/GovernancePage";
import {
  buildSystemSnapshot,
  diffSnapshots,
  scoreFidelity,
} from "@/ai-lab/08-governance";
import {
  loadPreviousSnapshot,
  recordSnapshot,
} from "@/ai-lab/08-governance/store";
import { GenericSectionPage } from "@/components/wiki/pages/GenericSectionPage";
import { GenericModeNotice } from "@/components/wiki/pages/GenericModeNotice";
import { ScanCssVarsPage } from "@/components/wiki/pages/ScanCssVarsPage";
import { ScanStylesPage } from "@/components/wiki/pages/ScanStylesPage";
import { ScanComponentsHubPage } from "@/components/wiki/pages/ScanComponentsHubPage";
import { ScanInventoryPage } from "@/components/wiki/pages/ScanInventoryPage";
import { IRWikiChromeStyles } from "@/components/wiki/IRWikiChromeStyles";
import { WikiFontFaces } from "@/components/wiki/WikiFontFaces";
import { GoogleFontsLink } from "@/components/wiki/GoogleFontsLink";
import { listActivity } from "@/lib/activity/store";
import { resolveComponentExcerptForDoc } from "@/lib/scan/excerpt";
import { ensureDesignIRWithFonts } from "@/lib/design-ir/ensure";
import { DesignIRProvider } from "@/lib/design-ir/context";
import type { DesignIR } from "@/lib/design-ir/schema";
import { getDocLifecycle } from "@/lib/wiki/doc-lifecycle";
import { normalizeWikiNav } from "@/lib/wiki/normalize-nav";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ doc?: string }>;
};

function resolveRoute(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) return "introduction";
  return slug.join("/");
}

export default async function WikiPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { doc: docParam } = await searchParams;
  const route = resolveRoute(slug);

  let fileName: string;
  try {
    fileName = resolveDocParam(docParam) ?? getDefaultDocFileName();
  } catch {
    notFound();
  }

  await assertWikiDocAccess(fileName);

  let system;
  try {
    await prepareDesignSystemDoc(fileName);
    system = loadDesignSystem(fileName);
  } catch {
    notFound();
  }

  // The source list feeds a dropdown; a storage hiccup listing it must not
  // take down the document the reader actually asked for.
  let sources: Awaited<ReturnType<typeof listAccessibleDocSources>> = [];
  try {
    sources = await listAccessibleDocSources();
  } catch (err) {
    console.error("[wiki] source listing failed:", err);
  }
  const meta = getClientMeta(fileName);

  const ir = await ensureDesignIRWithFonts(fileName, system);

  // Step 1 honesty: preview docs (paste / upload / bundled sample) render the
  // wiki but never the release machinery. Only a real scan is "connected".
  const lifecycle = getDocLifecycle({ mode: system.mode });

  const content = renderRoute(route, system, ir, meta, sources, fileName, lifecycle);

  const navSystem = {
    ...system,
    nav: normalizeWikiNav(system.nav, lifecycle),
  };

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
      <DesignIRProvider ir={ir}>
        <WikiShell
          system={navSystem}
          sources={sources}
          currentFileName={fileName}
          lifecycle={lifecycle}
        >
          {content}
        </WikiShell>
      </DesignIRProvider>
    </>
  );
}

function renderRoute(
  route: string,
  system: ReturnType<typeof loadDesignSystem>,
  ir: DesignIR,
  meta: ReturnType<typeof getClientMeta>,
  sources: Awaited<ReturnType<typeof listAccessibleDocSources>>,
  docFileName: string,
  lifecycle: ReturnType<typeof getDocLifecycle>,
) {
  // Preview docs have no repo behind them — Pipeline & Releases are honest
  // empty states, not fake production cards. Covers every parser mode.
  if (lifecycle === "preview" && (route === "pipeline" || route === "releases")) {
    return <PreviewPipelineEmptyState route={route} />;
  }

  // Universal "Edit this section" target for structured (apollo) pages — maps a
  // page to its exact markdown heading so every page is editable.
  const se = (sectionHeading: string) => ({
    docFileName,
    sectionHeading,
    lifecycle,
  });

  if (system.mode === "workspace-scan") {
    if (route === "introduction") {
      return (
        <IntroductionPage
          system={system}
          ir={ir}
          meta={meta}
          sources={sources}
          docFileName={docFileName}
          lifecycle={lifecycle}
        />
      );
    }
    if (route === "foundation/color") {
      return (
        <ColorPage
          system={system}
          docFileName={docFileName}
          meta={meta}
          lifecycle={lifecycle}
        />
      );
    }
    if (route === "source") {
      return <SourcePage docFileName={docFileName} lifecycle={lifecycle} />;
    }
    if (route === "foundation/css-vars" && system.scanCssVars?.length) {
      return (
        <ScanCssVarsPage
          system={system}
          meta={meta}
          cssVars={system.scanCssVars}
        />
      );
    }
    if (
      route === "foundation/styles" &&
      (system.scanCssRules?.length || system.scanUtilityClasses?.length)
    ) {
      return (
        <ScanStylesPage
          system={system}
          meta={meta}
          rules={system.scanCssRules ?? []}
          utilityClasses={system.scanUtilityClasses}
        />
      );
    }
    if (route === "foundation/surfaces") {
      return <SurfacesPage system={system} docFileName={docFileName} meta={meta} />;
    }
    if (route === "foundation/spacing") {
      return (
        <SpacingPage
          system={system}
          ir={ir}
          docFileName={docFileName}
          meta={meta}
          lifecycle={lifecycle}
        />
      );
    }
    if (route === "components") {
      return (
        <ScanComponentsHubPage
          system={system}
          docFileName={docFileName}
          meta={meta}
        />
      );
    }
    if (route === "inventory") {
      return (
        <ScanInventoryPage
          system={system}
          docFileName={docFileName}
          meta={meta}
        />
      );
    }
    if (route === "sync") {
      return (
        <SyncPage
          system={system}
          meta={meta}
          sources={sources}
          docFileName={docFileName}
        />
      );
    }
    if (route === "releases") {
      return <ReleasesPage docFileName={docFileName} />;
    }
    if (route === "pipeline") {
      return <PipelinePage docFileName={docFileName} />;
    }
    if (route === "governance") {
      return renderGovernance(system, ir, docFileName);
    }
    if (route.startsWith("components/")) {
      const id = route.replace("components/", "");
      const component = system.components.find((c) => c.id === id);
      if (component) {
        const activity = listActivity(docFileName, {
          componentId: component.id,
          limit: 25,
        });
        return (
          <ComponentDetailPage
            system={system}
            component={component}
            docFileName={docFileName}
            activity={activity}
            sourceExcerpt={resolveComponentExcerptForDoc(docFileName, component)}
          />
        );
      }
    }
    if (route.startsWith("doc/")) {
      const id = route.replace("doc/", "");
      if (id === "design-tokens" || id === "1-design-tokens") {
        return <ColorPage system={system} docFileName={docFileName} meta={meta} />;
      }
      if (/component-library/i.test(id)) {
        return (
          <ScanComponentsHubPage
            system={system}
            docFileName={docFileName}
            meta={meta}
          />
        );
      }
      const scannedComponent = system.components.find((c) => c.id === id);
      if (scannedComponent?.scan) {
        const activity = listActivity(docFileName, {
          componentId: scannedComponent.id,
          limit: 25,
        });
        return (
          <ComponentDetailPage
            system={system}
            component={scannedComponent}
            docFileName={docFileName}
            activity={activity}
            sourceExcerpt={resolveComponentExcerptForDoc(
              docFileName,
              scannedComponent,
            )}
          />
        );
      }
    }
    notFound();
  }

  if (system.mode === "generic") {
    if (route === "introduction") {
      return (
        <IntroductionPage
          system={system}
          ir={ir}
          meta={meta}
          sources={sources}
          docFileName={docFileName}
          lifecycle={lifecycle}
        />
      );
    }
    if (route === "source") {
      return <SourcePage docFileName={docFileName} lifecycle={lifecycle} />;
    }
    if (route === "sync") {
      return (
        <SyncPage
          system={system}
          meta={meta}
          sources={sources}
          docFileName={docFileName}
        />
      );
    }
    if (route === "releases") {
      return <ReleasesPage docFileName={docFileName} />;
    }
    if (route === "pipeline") {
      return <PipelinePage docFileName={docFileName} />;
    }
    if (route === "governance") {
      return renderGovernance(system, ir, docFileName);
    }
    if (route.startsWith("components/")) {
      const id = route.replace("components/", "");
      const component = system.components.find((c) => c.id === id);
      if (component) {
        const activity = listActivity(docFileName, {
          componentId: component.id,
          limit: 25,
        });
        return (
          <ComponentDetailPage
            system={system}
            component={component}
            docFileName={docFileName}
            activity={activity}
            sourceExcerpt={resolveComponentExcerptForDoc(docFileName, component)}
          />
        );
      }
    }
    if (route.startsWith("doc/")) {
      const id = route.replace("doc/", "");
      const scannedComponent = system.components.find((c) => c.id === id);
      if (scannedComponent?.scan) {
        const activity = listActivity(docFileName, {
          componentId: scannedComponent.id,
          limit: 25,
        });
        return (
          <ComponentDetailPage
            system={system}
            component={scannedComponent}
            docFileName={docFileName}
            activity={activity}
            sourceExcerpt={resolveComponentExcerptForDoc(
              docFileName,
              scannedComponent,
            )}
          />
        );
      }
      const section = system.sections?.find((s) => s.id === id);
      if (section) {
        const navItem = system.nav
          .flatMap((g) => g.items)
          .find((i) => i.id === id);
        const subsections = navItem?.children
          ?.map((c) => system.sections?.find((s) => s.id === c.id))
          .filter((s): s is NonNullable<typeof s> => !!s);
        return (
          <GenericSectionPage
            section={section}
            docFileName={docFileName}
            lifecycle={lifecycle}
          >
            {subsections}
          </GenericSectionPage>
        );
      }
    }
    return (
      <GenericModeNotice
        route={route}
        fileName={meta.sourceLabel.split("/").pop() ?? "document.md"}
      />
    );
  }

  switch (route) {
    case "introduction":
      return (
        <IntroductionPage
          system={system}
          ir={ir}
          meta={meta}
          sources={sources}
          docFileName={docFileName}
          lifecycle={lifecycle}
        />
      );
    case "foundation/color":
      return (
        <ColorPage
          system={system}
          docFileName={docFileName}
          meta={meta}
          lifecycle={lifecycle}
          sectionEdit={se("Tokens — Colors")}
        />
      );
    case "foundation/typography":
      return (
        <TypographyPage
          system={system}
          docFileName={docFileName}
          meta={meta}
          lifecycle={lifecycle}
          sectionEdit={se("Tokens — Typography")}
        />
      );
    case "foundation/spacing":
      return (
        <SpacingPage
          system={system}
          ir={ir}
          docFileName={docFileName}
          meta={meta}
          lifecycle={lifecycle}
          sectionEdit={se("Tokens — Spacing & Shapes")}
        />
      );
    case "source":
      return <SourcePage docFileName={docFileName} lifecycle={lifecycle} />;
    case "foundation/surfaces":
      return (
        <SurfacesPage
          system={system}
          docFileName={docFileName}
          meta={meta}
          sectionEdit={se("Surfaces")}
        />
      );
    case "foundation/layout":
      return (
        <LayoutPage
          system={system}
          docFileName={docFileName}
          meta={meta}
          sectionEdit={se("Layout")}
        />
      );
    case "foundation/imagery":
      return (
        <ImageryPage
          system={system}
          docFileName={docFileName}
          meta={meta}
          sectionEdit={se("Imagery")}
        />
      );
    case "foundation/agent-guide":
      return (
        <AgentGuidePage
          system={system}
          docFileName={docFileName}
          meta={meta}
          lifecycle={lifecycle}
          sectionEdit={se("Agent Prompt Guide")}
        />
      );
    case "demo":
      return <DemoPage system={system} docFileName={docFileName} />;
    case "governance":
      return renderGovernance(system, ir, docFileName);
    case "playground":
      return <ComponentPlaygroundPage system={system} docFileName={docFileName} />;
    case "components/buttons":
      return <ButtonsPage system={system} docFileName={docFileName} meta={meta} />;
    case "guidelines":
      return (
        <GuidelinesPage
          system={system}
          docFileName={docFileName}
          meta={meta}
          lifecycle={lifecycle}
          sectionEdit={se("Do's and Don'ts")}
        />
      );
    case "sync":
      return (
        <SyncPage
          system={system}
          meta={meta}
          sources={sources}
          docFileName={docFileName}
        />
      );
    case "releases":
      return <ReleasesPage docFileName={docFileName} />;
    case "pipeline":
      return <PipelinePage docFileName={docFileName} />;
    default: {
      if (route.startsWith("components/")) {
        const id = route.replace("components/", "");
        const component = system.components.find((c) => c.id === id);
        if (component) {
          const activity = listActivity(docFileName, {
            componentId: component.id,
            limit: 25,
          });
          return (
            <ComponentDetailPage
              system={system}
              component={component}
              docFileName={docFileName}
              activity={activity}
              sourceExcerpt={resolveComponentExcerptForDoc(docFileName, component)}
            />
          );
        }
      }
      notFound();
    }
  }
}

function renderGovernance(
  system: ReturnType<typeof loadDesignSystem>,
  ir: DesignIR,
  docFileName: string,
) {
  const report = scoreFidelity(system, ir);

  // History and diffing are enrichment; a doc whose stored history will not
  // parse must not take the governance page down with it.
  let diff: ReturnType<typeof diffSnapshots> | null = null;
  let previousLabel: string | null = null;
  try {
    const snapshot = buildSystemSnapshot(system, ir);
    recordSnapshot(docFileName, snapshot);
    const previous = loadPreviousSnapshot(docFileName, snapshot.contentHash);
    diff = previous ? diffSnapshots(previous, snapshot) : null;
    previousLabel = previous
      ? new Date(previous.updatedAt).toLocaleDateString()
      : null;
  } catch (err) {
    console.error("[wiki] governance history failed:", docFileName, err);
  }

  let teamActivity: ReturnType<typeof listActivity> = [];
  try {
    teamActivity = listActivity(docFileName, { limit: 30 });
  } catch (err) {
    console.error("[wiki] activity read failed:", docFileName, err);
  }

  return (
    <GovernancePage
      report={report}
      diff={diff}
      previousLabel={previousLabel}
      system={system}
      docFileName={docFileName}
      teamActivity={teamActivity}
    />
  );
}
