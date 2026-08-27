import {
  isApolloStructuredMarkdown,
  isComprehensiveWikiMarkdown,
} from "@/lib/parser/generic";
import { isWorkspaceScanMarkdown } from "@/lib/scan/parse";

/** True when deterministic structured parser cannot run but doc looks design-related. */
export function needsParserAssist(markdown: string): boolean {
  if (!markdown.trim() || markdown.length < 120) return false;
  // A captured system is written by this codebase in the parser's own shape;
  // "Tokens — Colors" is its signature. Sending it to a model to be
  // normalised would rewrite a document that needs no rewriting — and once
  // a key was set on the deployment, it did, inside every capture, with no
  // short timeout, until the platform limit cut the response off.
  if (/^## Tokens — Colors\s*$/m.test(markdown)) return false;
  if (isApolloStructuredMarkdown(markdown)) return false;
  /** Wiki docs keep their own TOC — never squash into Apollo skeleton. */
  if (isWorkspaceScanMarkdown(markdown)) return false;
  if (isComprehensiveWikiMarkdown(markdown)) return false;

  const hasHex = /#[0-9a-fA-F]{3,8}\b/.test(markdown);
  const designish =
    /\b(design system|style guide|tokens?|typography|color palette|components?|border[- ]?radius|cta|button)\b/i.test(
      markdown,
    );
  const hasTable = /\|.+\|/.test(markdown) && /\n\|[-:| ]+\|/.test(markdown);

  return (hasHex && designish) || (hasHex && hasTable) || (designish && hasTable);
}

export function parserAssistEnabled(): boolean {
  if (process.env.AI_LAB_PARSER_ASSIST === "0") return false;
  if (process.env.AI_LAB_PARSER_ASSIST === "false") return false;
  return true;
}
