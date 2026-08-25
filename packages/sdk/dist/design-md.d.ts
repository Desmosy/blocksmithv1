export type DesignMdOverride = {
    role?: string;
    description?: string;
};
export declare function updateDesignMd(workspaceRoot: string, componentId: string, data: DesignMdOverride): void;
/**
 * Write the full design-system markdown to DESIGN.md (overwrites). BlockSmith
 * owns this file as generated output — it is the complete wiki export with
 * promoted governance merged in, not a per-component delta.
 */
export declare function writeDesignMd(workspaceRoot: string, markdown: string): string;
/**
 * Write blocksmith.lock at the repo root so CI and agents resolve the exact
 * block versions a human promoted in the wiki.
 */
export declare function writeLock(workspaceRoot: string, lock: unknown): string;
export declare function updateWikiOverrides(workspaceRoot: string, overridesMap: Record<string, DesignMdOverride>): void;
