import { hrefWithDoc } from "@/lib/wiki/doc-param";

export function wikiUrlForDoc(docRef: string): string {
  return hrefWithDoc("/wiki", docRef);
}
