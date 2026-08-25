"use client";

import { createContext, useContext } from "react";
import type { DesignIR } from "@/lib/design-ir/schema";

const DesignIRContext = createContext<DesignIR | null>(null);

export function DesignIRProvider({
  ir,
  children,
}: {
  ir: DesignIR;
  children: React.ReactNode;
}) {
  return (
    <DesignIRContext.Provider value={ir}>{children}</DesignIRContext.Provider>
  );
}

export function useDesignIR(): DesignIR {
  const ir = useContext(DesignIRContext);
  if (!ir) {
    throw new Error("useDesignIR requires DesignIRProvider");
  }
  return ir;
}

export function useDesignIROptional(): DesignIR | null {
  return useContext(DesignIRContext);
}
