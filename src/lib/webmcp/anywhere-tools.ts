/**
 * The tools BlockSmith registers on *other people's* pages.
 *
 * `public/webmcp/blocksmith.js` — run as a bookmarklet or by the extension's
 * content script — registers these on whatever site is open, so an agent
 * browsing that site can capture its design system or audit the page
 * against one. The script is plain JavaScript and cannot import this file;
 * these descriptors exist so the manifest and the docs describe the same
 * surface the script registers. `verify:webmcp` checks the names agree.
 */

export type AnywhereToolDescriptor = {
  name: string;
  description: string;
  parameters: { name: string; description: string; required: boolean }[];
  readOnly: boolean;
  /** Which BlockSmith route does the work; the page only collects. */
  backedBy: string;
};

export const ANYWHERE_SCRIPT_PATH = "/webmcp/blocksmith.js";

export const ANYWHERE_TOOLS: readonly AnywhereToolDescriptor[] = [
  {
    name: "blocksmith_capture_this_site",
    description:
      "Read the design system of the page the user is on — colours, type, spacing, radii and repeated components, measured from the rendered page — and save it as a governed design system with a link to open.",
    parameters: [],
    readOnly: true,
    backedBy: "POST /api/capture",
  },
  {
    name: "blocksmith_audit_this_page",
    description:
      "Collect what the current page actually paints and judge it against a design system: how much is on-system, near misses with the token to use, values with no token.",
    parameters: [
      { name: "doc", description: "Design system to judge against, e.g. upload:capture-cohere-5f71a053.md. Defaults to the server's default system.", required: false },
    ],
    readOnly: true,
    backedBy: "POST /api/webmcp/invoke → audit_page_styles",
  },
  {
    name: "blocksmith_get_rules",
    description: "The governance rules of a design system — palette, do's and don'ts — without leaving the current page.",
    parameters: [{ name: "doc", description: "Design system to read; defaults to the server's default system.", required: false }],
    readOnly: true,
    backedBy: "POST /api/webmcp/invoke → get_governance_rules",
  },
  {
    name: "blocksmith_page_context",
    description: "Where the user is: the page's address and title, and a first count of the distinct colours, typefaces and radii it paints. Runs entirely in the page.",
    parameters: [],
    readOnly: true,
    backedBy: "the page itself",
  },
];

export const ANYWHERE_TOOL_NAMES: readonly string[] = ANYWHERE_TOOLS.map((t) => t.name);
