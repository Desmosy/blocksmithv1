import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "blocksmith.blocks.v1 — the Design IR protocol",
  description:
    "The interchange format for design truth. Any tool compiles in; any consumer compiles out — wiki, npm, agents, firmware. blocksmith.lock pins production in every repo.",
};

const NAV = [
  { href: "/protocol", label: "Overview" },
  { href: "/protocol/blocks.v1", label: "blocks.v1 — the graph" },
  { href: "/protocol/lock.v1", label: "lock.v1 — the pin" },
  { href: "/protocol/registry.v1", label: "registry.v1 — versions" },
  { href: "/protocol/adapters", label: "Ingest adapters" },
  { href: "/protocol/targets", label: "Compile targets" },
  { href: "/protocol/conformance", label: "Conformance" },
];

export default function ProtocolLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0b0e] text-[#e7e7ea]" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="mx-auto flex max-w-6xl gap-10 px-6 py-10">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-10">
            <Link href="/protocol" className="block text-sm font-bold tracking-tight">
              blocksmith<span className="text-[#d97757]">.blocks.v1</span>
            </Link>
            <p className="mt-1 text-[11px] text-[#8a8a92]">
              Design IR — open interchange format
            </p>
            <nav className="mt-6 space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-2.5 py-1.5 text-[13px] text-[#b9b9c0] hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 space-y-1.5 text-[11px] text-[#8a8a92]">
              <p>
                <a className="underline underline-offset-2 hover:text-white" href="/schema/blocksmith.blocks.v1.json">
                  blocks.v1 schema ↓
                </a>
              </p>
              <p>
                <a className="underline underline-offset-2 hover:text-white" href="/schema/blocksmith.lock.v1.json">
                  lock.v1 schema ↓
                </a>
              </p>
              <p>
                <a className="underline underline-offset-2 hover:text-white" href="/schema/blocksmith.registry.v1.json">
                  registry.v1 schema ↓
                </a>
              </p>
              <p className="pt-2">
                npm: <code className="text-[#d97757]">@blocksmith/protocol</code>
              </p>
              <p>
                <Link className="underline underline-offset-2 hover:text-white" href="/wiki/pipeline">
                  Reference impl: Pipeline →
                </Link>
              </p>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-24">{children}</main>
      </div>
    </div>
  );
}
