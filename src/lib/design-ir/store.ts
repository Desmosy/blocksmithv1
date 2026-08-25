import "server-only";

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import type { LoadedDesignSystem } from "@/lib/clients/registry";
import { compileDesignIR } from "@/lib/design-ir/compile";
import { designIRSchema, type DesignIR } from "@/lib/design-ir/schema";

const BLOCKSMITH_ROOT = join(process.cwd(), ".blocksmith");
const DESIGN_ROOT = join(BLOCKSMITH_ROOT, "design");

function safeDocKey(docRef: string): string {
  return docRef.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function irPath(docRef: string): string {
  return join(DESIGN_ROOT, safeDocKey(docRef), "ir.json");
}

export function persistDesignIR(ir: DesignIR): void {
  const dir = join(DESIGN_ROOT, safeDocKey(ir.docRef));
  mkdirSync(dir, { recursive: true });
  const parsed = designIRSchema.parse(ir);
  writeFileSync(irPath(ir.docRef), JSON.stringify(parsed, null, 2), "utf-8");
}

export function loadDesignIR(docRef: string): DesignIR | null {
  const path = irPath(docRef);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return designIRSchema.parse(raw);
  } catch {
    return null;
  }
}

export function persistDesignIRFromSystem(
  docRef: string,
  system: LoadedDesignSystem,
): DesignIR {
  const ir = compileDesignIR(docRef, system);
  persistDesignIR(ir);
  return ir;
}
