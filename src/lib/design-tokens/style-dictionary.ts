import StyleDictionary from "style-dictionary";
import type { BlocksmithGraphV1 } from "@/lib/ir/types";

/** Emit portable CSS and JSON from the same promoted graph used by device targets. */
export async function buildStyleDictionaryTargets(graph: BlocksmithGraphV1, outDir: string) {
  const tokens: Record<string, { value: unknown; type?: string }> = {};
  for (const block of graph.blocks.filter((item) => item.type === "token")) {
    const value = block.content.value;
    if (value == null) continue;
    const name = block.id.replace(/^token:/, "").replace(/[^a-zA-Z0-9_-]+/g, "-");
    tokens[name] = { value, type: block.id.includes(":color:") ? "color" : undefined };
  }
  const dictionary = new StyleDictionary({
    tokens,
    platforms: {
      css: { transformGroup: "css", buildPath: `${outDir}/`, files: [{ destination: "tokens.css", format: "css/variables" }] },
      json: { transformGroup: "js", buildPath: `${outDir}/`, files: [{ destination: "tokens.json", format: "json/nested" }] },
    },
  });
  await dictionary.buildAllPlatforms();
}
