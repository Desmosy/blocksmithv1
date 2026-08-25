/**
 * Protocol validators — dependency-free structural validation that mirrors
 * the published JSON Schemas one-to-one (schemas/ in this package). The
 * schemas remain the normative spec; these validators are the executable
 * convenience. Conformance fixtures exercise both.
 */
import { blockContentHash, graphHash } from "./hash";
const BLOCK_TYPES = new Set([
    "component",
    "token",
    "guideline",
    "agent-rule",
    "page",
]);
const STATUSES = new Set(["draft", "finalized", "stale", "conflict"]);
const INGESTS = new Set([
    "scan",
    "markdown",
    "governance",
    "figma",
    "paste",
    "storybook",
    "agent-template",
]);
const EDIT_ORIGINS = new Set(["web", "ide", "mcp", "ingest"]);
const ID_RE = /^[a-z0-9][a-z0-9:_-]*$/;
const HASH_RE = /^sha256:[0-9a-f]+$/;
function isObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
class Ctx {
    constructor() {
        this.errors = [];
    }
    fail(path, message) {
        this.errors.push({ path, message });
    }
    result() {
        return { ok: this.errors.length === 0, errors: this.errors };
    }
}
function checkString(ctx, v, path, minLength = 0) {
    if (typeof v !== "string" || v.length < minLength) {
        ctx.fail(path, `expected string${minLength ? ` (minLength ${minLength})` : ""}`);
        return false;
    }
    return true;
}
function checkBlock(ctx, b, path) {
    if (!isObject(b)) {
        ctx.fail(path, "block must be an object");
        return false;
    }
    if (checkString(ctx, b.id, `${path}.id`, 1) && !ID_RE.test(b.id)) {
        ctx.fail(`${path}.id`, `id "${b.id}" must match ${ID_RE}`);
    }
    if (!BLOCK_TYPES.has(b.type)) {
        ctx.fail(`${path}.type`, `unknown type "${b.type}"`);
    }
    checkString(ctx, b.title, `${path}.title`, 1);
    if (typeof b.version !== "number" || !Number.isInteger(b.version) || b.version < 1) {
        ctx.fail(`${path}.version`, "version must be an integer >= 1");
    }
    if (!STATUSES.has(b.status)) {
        ctx.fail(`${path}.status`, `unknown status "${b.status}"`);
    }
    if (!isObject(b.source) || typeof b.source.file !== "string") {
        ctx.fail(`${path}.source`, "source.file is required");
    }
    else if (b.source.ingest != null && !INGESTS.has(b.source.ingest)) {
        ctx.fail(`${path}.source.ingest`, `unknown ingest "${b.source.ingest}"`);
    }
    if (!isObject(b.content)) {
        ctx.fail(`${path}.content`, "content must be an object");
    }
    checkString(ctx, b.updatedAt, `${path}.updatedAt`, 1);
    if (checkString(ctx, b.contentHash, `${path}.contentHash`, 1) &&
        !HASH_RE.test(b.contentHash)) {
        ctx.fail(`${path}.contentHash`, "must match ^sha256:[0-9a-f]+$");
    }
    if (b.editedBy != null && !EDIT_ORIGINS.has(b.editedBy)) {
        ctx.fail(`${path}.editedBy`, `unknown editedBy "${b.editedBy}"`);
    }
    return ctx.errors.length === 0;
}
export function validateGraph(input, options = {}) {
    const ctx = new Ctx();
    if (!isObject(input)) {
        ctx.fail("$", "graph must be an object");
        return ctx.result();
    }
    if (input.schema !== "blocksmith.blocks.v1") {
        ctx.fail("$.schema", `expected "blocksmith.blocks.v1", got "${input.schema}"`);
    }
    checkString(ctx, input.docRef, "$.docRef", 1);
    if (typeof input.systemId !== "string")
        ctx.fail("$.systemId", "expected string");
    if (checkString(ctx, input.contentHash, "$.contentHash", 1) &&
        !HASH_RE.test(input.contentHash)) {
        ctx.fail("$.contentHash", "must match ^sha256:[0-9a-f]+$");
    }
    if (!Array.isArray(input.blocks)) {
        ctx.fail("$.blocks", "blocks must be an array");
        return ctx.result();
    }
    const seen = new Set();
    input.blocks.forEach((b, i) => {
        checkBlock(ctx, b, `$.blocks[${i}]`);
        if (isObject(b) && typeof b.id === "string") {
            if (seen.has(b.id))
                ctx.fail(`$.blocks[${i}].id`, `duplicate id "${b.id}"`);
            seen.add(b.id);
            if (options.officialOnly &&
                (b.status === "draft" || b.status === "conflict")) {
                ctx.fail(`$.blocks[${i}].status`, `official graph must not contain "${b.status}" blocks — agents and compile targets read promoted versions only`);
            }
            if (options.verifyHashes && isObject(b.content)) {
                const expected = blockContentHash(b.id, b.type, b.content);
                if (b.contentHash !== expected) {
                    ctx.fail(`$.blocks[${i}].contentHash`, `hash mismatch: got ${b.contentHash}, canonical is ${expected}`);
                }
            }
        }
    });
    if (options.verifyHashes && ctx.errors.length === 0) {
        const expected = graphHash(input.blocks.map((b) => ({
            id: b.id,
            version: b.version,
            contentHash: b.contentHash,
        })));
        if (input.contentHash !== expected) {
            ctx.fail("$.contentHash", `graph hash mismatch: got ${input.contentHash}, canonical is ${expected}`);
        }
    }
    return ctx.result();
}
export function validateLock(input) {
    const ctx = new Ctx();
    if (!isObject(input)) {
        ctx.fail("$", "lock must be an object");
        return ctx.result();
    }
    if (input.schema !== "blocksmith.lock.v1") {
        ctx.fail("$.schema", `expected "blocksmith.lock.v1", got "${input.schema}"`);
    }
    checkString(ctx, input.docRef, "$.docRef", 1);
    if (checkString(ctx, input.contentHash, "$.contentHash", 1) &&
        !HASH_RE.test(input.contentHash)) {
        ctx.fail("$.contentHash", "must match ^sha256:[0-9a-f]+$");
    }
    checkString(ctx, input.generatedAt, "$.generatedAt", 1);
    if (!isObject(input.blocks)) {
        ctx.fail("$.blocks", "blocks must be an object map");
        return ctx.result();
    }
    for (const [id, pin] of Object.entries(input.blocks)) {
        if (!isObject(pin)) {
            ctx.fail(`$.blocks["${id}"]`, "pin must be an object");
            continue;
        }
        if (typeof pin.version !== "number" ||
            !Number.isInteger(pin.version) ||
            pin.version < 1) {
            ctx.fail(`$.blocks["${id}"].version`, "version must be an integer >= 1");
        }
        if (typeof pin.contentHash !== "string" || !HASH_RE.test(pin.contentHash)) {
            ctx.fail(`$.blocks["${id}"].contentHash`, "must match ^sha256:[0-9a-f]+$");
        }
    }
    return ctx.result();
}
export function validateRegistryEntry(input) {
    const ctx = new Ctx();
    if (!isObject(input)) {
        ctx.fail("$", "entry must be an object");
        return ctx.result();
    }
    if (checkString(ctx, input.id, "$.id", 1) && !ID_RE.test(input.id)) {
        ctx.fail("$.id", `id must match ${ID_RE}`);
    }
    if (!Array.isArray(input.versions)) {
        ctx.fail("$.versions", "versions must be an array");
        return ctx.result();
    }
    let prev = 0;
    input.versions.forEach((v, i) => {
        if (!isObject(v)) {
            ctx.fail(`$.versions[${i}]`, "must be an object");
            return;
        }
        if (typeof v.version !== "number" || v.version <= prev) {
            ctx.fail(`$.versions[${i}].version`, `versions must be strictly ascending (append-only); got ${v.version} after ${prev}`);
        }
        else {
            prev = v.version;
        }
        if (!STATUSES.has(v.status)) {
            ctx.fail(`$.versions[${i}].status`, `unknown status "${v.status}"`);
        }
        if (!BLOCK_TYPES.has(v.type)) {
            ctx.fail(`$.versions[${i}].type`, `unknown type "${v.type}"`);
        }
        if (typeof v.contentHash !== "string" || !HASH_RE.test(v.contentHash)) {
            ctx.fail(`$.versions[${i}].contentHash`, "must match ^sha256:[0-9a-f]+$");
        }
        if (!isObject(v.content)) {
            ctx.fail(`$.versions[${i}].content`, "content must be an object");
        }
        if (!isObject(v.source) || typeof v.source.file !== "string") {
            ctx.fail(`$.versions[${i}].source`, "source.file is required");
        }
        checkString(ctx, v.createdAt, `$.versions[${i}].createdAt`, 1);
    });
    if (input.official != null) {
        const versions = input.versions.map((v) => v.version);
        if (!versions.includes(input.official)) {
            ctx.fail("$.official", `official pointer v${input.official} not present in versions — pointers may only reference recorded versions`);
        }
    }
    return ctx.result();
}
export function validateRegistryManifest(input) {
    const ctx = new Ctx();
    if (!isObject(input)) {
        ctx.fail("$", "manifest must be an object");
        return ctx.result();
    }
    if (input.schema !== "blocksmith.registry.v1") {
        ctx.fail("$.schema", `expected "blocksmith.registry.v1", got "${input.schema}"`);
    }
    checkString(ctx, input.docRef, "$.docRef", 1);
    if (typeof input.systemId !== "string")
        ctx.fail("$.systemId", "expected string");
    checkString(ctx, input.lastIngestAt, "$.lastIngestAt", 1);
    if (typeof input.officialGraphHash !== "string" ||
        (input.officialGraphHash !== "" && !HASH_RE.test(input.officialGraphHash))) {
        ctx.fail("$.officialGraphHash", "must be empty or match ^sha256:[0-9a-f]+$");
    }
    for (const key of ["blockCount", "promotedCount", "draftCount", "staleCount"]) {
        const v = input[key];
        if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
            ctx.fail(`$.${key}`, "must be an integer >= 0");
        }
    }
    return ctx.result();
}
export function validateCompileTargets(input) {
    const ctx = new Ctx();
    if (!isObject(input)) {
        ctx.fail("$", "manifest must be an object");
        return ctx.result();
    }
    if (input.schema !== "blocksmith.compile-targets.v1") {
        ctx.fail("$.schema", `expected "blocksmith.compile-targets.v1"`);
    }
    if (!Array.isArray(input.targets)) {
        ctx.fail("$.targets", "targets must be an array");
        return ctx.result();
    }
    input.targets.forEach((t, i) => {
        if (!isObject(t)) {
            ctx.fail(`$.targets[${i}]`, "must be an object");
            return;
        }
        checkString(ctx, t.id, `$.targets[${i}].id`, 1);
        if (t.input !== "blocksmith.blocks.v1") {
            ctx.fail(`$.targets[${i}].input`, 'must be "blocksmith.blocks.v1"');
        }
        if (typeof t.officialOnly !== "boolean") {
            ctx.fail(`$.targets[${i}].officialOnly`, "must be boolean");
        }
        checkString(ctx, t.output, `$.targets[${i}].output`, 1);
    });
    return ctx.result();
}
/**
 * Verify a lock against the graph it claims to pin — the staleness check
 * every consumer should run before trusting pinned versions.
 */
export function verifyLockAgainstGraph(lock, graph) {
    const ctx = new Ctx();
    const byId = new Map(graph.blocks.map((b) => [b.id, b]));
    for (const b of graph.blocks) {
        const pin = lock.blocks[b.id];
        if (!pin) {
            ctx.fail(`$.blocks["${b.id}"]`, "in graph but not pinned in lock");
            continue;
        }
        if (pin.version !== b.version) {
            ctx.fail(`$.blocks["${b.id}"].version`, `locked v${pin.version}, graph has v${b.version}`);
        }
        else if (pin.contentHash !== b.contentHash) {
            ctx.fail(`$.blocks["${b.id}"].contentHash`, "contentHash mismatch — lock corrupted or hand-edited");
        }
    }
    for (const id of Object.keys(lock.blocks)) {
        if (!byId.has(id)) {
            ctx.fail(`$.blocks["${id}"]`, "pinned in lock but absent from graph");
        }
    }
    const expected = graphHash(graph.blocks.map((b) => ({
        id: b.id,
        version: b.version,
        contentHash: b.contentHash,
    })));
    const stale = lock.contentHash !== expected;
    if (stale) {
        ctx.fail("$.contentHash", `lock is STALE: pinned ${lock.contentHash}, graph is ${expected}`);
    }
    const result = ctx.result();
    return { ...result, stale };
}
/** Convenience: build a valid lock from an official graph. */
export function lockFromGraph(graph, options) {
    const blocks = {};
    for (const b of [...graph.blocks].sort((x, y) => x.id.localeCompare(y.id))) {
        blocks[b.id] = { version: b.version, contentHash: b.contentHash };
    }
    return {
        schema: "blocksmith.lock.v1",
        docRef: graph.docRef,
        systemId: graph.systemId,
        contentHash: graphHash(graph.blocks.map((b) => ({
            id: b.id,
            version: b.version,
            contentHash: b.contentHash,
        }))),
        generatedAt: new Date().toISOString(),
        blocks,
        ...(options?.packageName ? { package: { name: options.packageName } } : {}),
    };
}
