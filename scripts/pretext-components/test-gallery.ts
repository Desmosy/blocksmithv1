/**
 * Smoke-test @blocksmith/pretext-components gallery composition.
 * Run: npm run pretext-components:test -- upload:design-dcd1a101.md
 */
import { loadDocForAiLab } from "../../src/ai-lab/shared/load-doc";
import { compileDesignIR } from "../../src/lib/design-ir/compile";
import { buildComponentGallery } from "../../src/lib/pretext-components/adapter";

const docRef = process.argv[2] ?? "upload:design-dcd1a101.md";

async function main() {
  const { system } = loadDocForAiLab(docRef);
  const ir = compileDesignIR(docRef, system);
  const gallery = buildComponentGallery(ir, system);

  console.log(
    `Pretext Components — ${gallery.systemName} (${gallery.items.length} frames)\n`,
  );

  for (const { component, spec } of gallery.items) {
    console.log(`• ${component.title} — ${spec.kind} (${spec.variant})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
