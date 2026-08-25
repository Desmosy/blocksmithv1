/**
 * Smoke-test component preview parsing (no GPU).
 * Run: npm run ai-lab:previews -- upload:design-dcd1a101.md
 */
import { loadDocForAiLab } from "../../src/ai-lab/shared/load-doc";
import { compileDesignIR } from "../../src/lib/design-ir/compile";
import {
  buildPreviewContextFromIR,
  classifyComponentKind,
  parseComponentPreviewSpec,
} from "../../src/ai-lab/04-component-previews";

const docRef = process.argv[2] ?? "upload:design-dcd1a101.md";

async function main() {
  const { system } = loadDocForAiLab(docRef);
  const ir = compileDesignIR(docRef, system);
  const ctx = buildPreviewContextFromIR(ir);

  console.log(`Component previews — ${ir.systemName} (${ir.tokens.components.length} components)\n`);

  for (const comp of ir.tokens.components) {
    const kind = classifyComponentKind(comp);
    const spec = parseComponentPreviewSpec(comp, ctx);
    console.log(`• ${comp.title}`);
    console.log(`  kind=${kind} variant=${spec.variant} bg=${spec.backgroundColor} radius=${spec.borderRadius}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
