# Style contract for the BlockSmith Constitution

Every chapter in `docs/constitution/` follows these rules. This file is the contract, not a chapter.

## Hard rules

1. **No em dashes and no en dashes.** The characters `—` and `–` must never appear in the text. Use a comma, a colon, parentheses, a period, or the word "and" instead. This applies to quoted material too: if you quote a source doc that used an em dash, rewrite the punctuation. Regular hyphens inside compound words (`design-system`, `two-way`) are fine.
2. **Write for one reader**: a strong technical cofounder who joined yesterday. They can read code. They know nothing about this project's history, vocabulary, or decisions.
3. **Always answer "why"**, not only "what". Every component, file, and decision gets a reason. If a thing exists because an earlier approach failed, say what failed and why.
4. **Ground every claim in the repo.** Cite real paths (`src/lib/ir/registry.ts`), real script names (`npm run verify:software`), real routes (`POST /api/wiki/promote`). If something is aspirational and not built, label it clearly as **Not built yet** or **Planned**.
5. **Never invent.** If you cannot verify a detail from the repo or the docs, either omit it or mark it `TODO: verify`.
6. **Length is not a problem.** Depth is the point. Do not summarize where you can explain.

## Voice

- Plain, direct, confident. Short sentences mixed with long ones.
- Second person ("you will find", "you own") is fine when addressing the cofounder.
- No marketing fluff, no hype adjectives, no "revolutionary", no "seamless".
- No emoji in prose. Tables may use a check or cross mark for status columns.

## Formatting

- Start each chapter with an H1 title, then a short block: **What this chapter covers**, **Why it matters**, **Read this if**.
- Use H2 for major sections, H3 for subsections.
- Use tables for comparisons and status. Use fenced code blocks for file trees, commands, schemas, and payloads.
- End each chapter with a **Open questions** section and a **Where to look in the code** section listing the key paths.
- Cross-link other chapters with relative links, for example `[Chapter 07](./07-design-ir-and-blocks.md)`.

## Status vocabulary (use these exact words)

| Word | Meaning |
|------|---------|
| **Shipped** | Built, in the repo, covered by a verify script or manually proven |
| **Built, unproven** | Code exists but has never run against a real external input |
| **Partial** | Some paths work, others are stubs |
| **Planned** | Designed on paper, no code |
| **Idea** | Not designed, listed so it is not lost |
