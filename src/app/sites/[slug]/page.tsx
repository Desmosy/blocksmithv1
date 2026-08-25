import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/cloud/orgs";
import { listPublishedDocumentsForOrg } from "@/lib/cloud/documents";
import { hrefWithDoc } from "@/lib/wiki/doc-param";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

function docLabel(fileName: string): string {
  return fileName
    .replace(/-[a-f0-9]{8}\.md$/i, "")
    .replace(/\.md$/i, "")
    .replace(/[-_]/g, " ")
    .trim();
}

export default async function PublicSitePage({ params }: PageProps) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const docs = await listPublishedDocumentsForOrg(org.id);

  return (
    <main className="public-site">
      <header className="public-site__header">
        <span className="public-site__brand">
          <span className="public-site__dot" aria-hidden />
          BlockSmith
        </span>
        <h1 className="public-site__title">{org.name}</h1>
        <p className="public-site__subtitle">
          Published design systems · {org.slug}.blocksmith.com
        </p>
      </header>

      {docs.length === 0 ? (
        <p className="public-site__empty">
          This team hasn’t published any wikis yet.
        </p>
      ) : (
        <ul className="public-site__list">
          {docs.map((d) => (
            <li key={d.fileName}>
              <Link
                href={`${hrefWithDoc("/wiki", d.docRef)}&site=${encodeURIComponent(org.slug)}`}
                className="public-site__card"
              >
                <span className="public-site__card-name">{docLabel(d.fileName)}</span>
                <span className="public-site__card-meta">
                  Updated {new Date(d.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="public-site__footer">
        Powered by <Link href="/">BlockSmith</Link> — design truth for humans and AI.
      </footer>
    </main>
  );
}
