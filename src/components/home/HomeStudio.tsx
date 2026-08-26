"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isApolloStructuredMarkdown } from "@/lib/parser/generic";
import { WikiGeneratingOverlay } from "@/components/wiki/WikiGeneratingOverlay";
import { markWikiBuilding } from "@/components/wiki/WikiBuildGate";
import { IconArrowRight } from "@/components/icons/streamline";
import { HomeTestimonials } from "./HomeTestimonials";
import { AuthChrome } from "@/components/auth/AuthChrome";
import { useAuth } from "@/components/auth/AuthProvider";
import { AnimatedLightBoard } from "@/components/ui/AnimatedLightBoard";
import { ScanWorkspaceCard } from "./ScanWorkspaceCard";
import { HomeHeroChat, type HeroTabId } from "./HomeHeroChat";
import { HomeUseCases } from "./HomeUseCases";
import { CodeBlock } from "@/components/ui/code-block";
import HeroAscii from "@/components/ui/hero-ascii";
import { motion, useInView, animate, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import Lenis from "lenis";

type RecentUpload = {
  docRef: string;
  fileName: string;
  label: string;
  bytes: number;
  savedAt: string;
};

type ImportResult = {
  docRef: string;
  wikiUrl: string;
  parser: "apollo" | "generic";
  label: string;
  systemName?: string;
  stats?: {
    colors: number;
    typography: number;
    components: number;
    surfaces: number;
  };
};

const NAV = [
  { label: "Wiki", href: "/wiki?doc=apollo.md" },
  { label: "Developers", href: "#developers" },
  { label: "Docs", href: "/protocol" },
] as const;

const FEATURES = [
  {
    tag: "Scan",
    title: "Ingest from your repo",
    body: "Connect GitHub. Tokens, components, and rules become structured blocks — not another static doc.",
    ascii: `
 ▀▄▀▄▀▄▀▄▀▄
 ▄▀▄▀▄▀▄▀▄▀
 ▀▄▀▄▀▄▀▄▀▄
 ▄▀▄▀▄▀▄▀▄▀
    `
  },
  {
    tag: "Wiki",
    title: "Humans approve in the browser",
    body: "Design leads edit roles, rules, and tokens. Staging stays separate until someone promotes.",
    ascii: `
 ┌──────┐
 │ ░░░░ │
 ├──────┤
 │ ▒▒▒▒ │
 └──────┘
    `
  },
  {
    tag: "Pipeline",
    title: "Promote like merge to main",
    body: "Staging → production per block. Diffs, batch promote, roll back.",
    ascii: `
 ═════╗
      ║
      ╚═════►
    `
  },
  {
    tag: "Lock",
    title: "Agents obey the pin",
    body: "blocksmith.lock in your repo. MCP and CI resolve pinned versions — no invented hex mid-session.",
    ascii: `
    ▄▄▄
   █   █
  ███████
  █ ▄▄▄ █
  ███████
    `
  },
];

const TRUSTED_LOGOS = [
  { name: "Figma", src: "/logos/trusted/figma.svg", quote: "Our designers moved fast. BlockSmith made sure our code moved just as fast without breaking anything." },
  { name: "Linear", src: "/logos/trusted/linear.svg", quote: "A flawless bridge between Figma and our React codebase. Pure governed truth." },
  { name: "Vercel", src: "/logos/trusted/vercel.svg", quote: "BlockSmith Pipelines caught token drift before it ever reached production." },
  { name: "Notion", src: "/logos/trusted/notion.svg", quote: "Finally, a way to scale our design system across teams without human bottlenecks." },
  { name: "Stripe", src: "/logos/trusted/stripe.svg", quote: "The interchange format that allows our agents and our firmware to share the same design language." },
  { name: "GitHub", src: "/logos/trusted/github.svg", quote: "Governance for design feels just like governance for code. It's brilliant." },
  { name: "Anthropic", src: "/logos/trusted/anthropic.svg", quote: "Our AI workflows now have absolute context on UI tokens and components." },
  { name: "Shopify", src: "/logos/trusted/shopify.svg", quote: "We completely eliminated manual handoffs. The truth lives in the protocol." },
  { name: "Cursor", src: "/logos/trusted/cursor.svg", quote: "The standard MCP server integration gives our developers instant access to design rules." },
  { name: "Hugging Face", src: "/logos/trusted/huggingface.svg", quote: "Seamless developer workflows powered by actual verifiable design truth." },
] as const;

const MARQUEE_LOGOS = [...TRUSTED_LOGOS, ...TRUSTED_LOGOS, ...TRUSTED_LOGOS];

const CLI_SNIPPET = `# Install & watch your workspace
npm install -g @block-smith/cli
blocksmith watch --workspace .

# Pull promoted design truth into the repo
blocksmith pull --doc scan-your-app.md

# CI gate — fail on off-token UI
npm run validate:ui`;

const NavMegaMenu = ({ label }: { label: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative h-full flex items-center group/nav"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className={`relative overflow-hidden text-base font-medium flex items-center h-full px-4 py-2 rounded-[3px] transition-colors duration-300 ${isOpen ? 'text-white' : 'text-ink-black'}`}>
        {/* Orange Curtain Background */}
        <span 
          className={`absolute inset-0 bg-signal-orange origin-bottom transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] ${isOpen ? 'scale-y-100' : 'scale-y-0'}`} 
        />
        {/* Foreground Content */}
        <span className="relative z-10 flex items-center gap-1.5">
          {label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>

      {/* Mega Menu Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 w-[600px] z-50">
          <div className="bg-white border border-black/10 shadow-2xl overflow-hidden flex flex-col font-plain">
            
            {/* Top row */}
            <div className="flex border-b border-black/10">
              <Link href="#platform" className="relative overflow-hidden flex-1 p-6 border-r border-black/10 flex items-center justify-between group">
                <span className="absolute inset-0 bg-signal-orange origin-bottom transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] scale-y-0 group-hover:scale-y-100" />
                <span className="relative z-10 font-planar text-lg tracking-tight text-black group-hover:text-white transition-colors duration-300">Platform Overview</span>
                <IconArrowRight size={16} className="relative z-10 text-black opacity-50 group-hover:text-white group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </Link>
              <Link href="#workflows" className="relative overflow-hidden flex-1 p-6 flex items-center justify-between group">
                <span className="absolute inset-0 bg-signal-orange origin-bottom transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] scale-y-0 group-hover:scale-y-100" />
                <span className="relative z-10 font-planar text-lg tracking-tight text-black group-hover:text-white transition-colors duration-300">Workflows</span>
                <IconArrowRight size={16} className="relative z-10 text-black opacity-50 group-hover:text-white group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </Link>
            </div>

            {/* Bottom columns */}
            <div className="flex p-6">
              <div className="flex-1 flex flex-col gap-4">
                <h4 className="font-gtstandardmono text-[10px] uppercase tracking-widest text-black/40">Features</h4>
                <ul className="flex flex-col gap-3">
                  <li className="text-[14px] font-medium text-ink-black hover:text-signal-orange cursor-pointer transition-colors">Component Mapping</li>
                  <li className="text-[14px] font-medium text-ink-black hover:text-signal-orange cursor-pointer transition-colors">Design Token Sync</li>
                  <li className="text-[14px] font-medium text-ink-black hover:text-signal-orange cursor-pointer transition-colors">Code Generation</li>
                  <li className="text-[14px] font-medium text-ink-black hover:text-signal-orange cursor-pointer transition-colors">Preview Environments</li>
                </ul>
              </div>
              <div className="flex-1 flex flex-col gap-4">
                <h4 className="font-gtstandardmono text-[10px] uppercase tracking-widest text-black/40">Services</h4>
                <ul className="flex flex-col gap-3">
                  <li className="text-[14px] font-medium text-ink-black hover:text-signal-orange cursor-pointer transition-colors">Managed CI/CD</li>
                  <li className="text-[14px] font-medium text-ink-black hover:text-signal-orange cursor-pointer transition-colors">Git Integrations</li>
                  <li className="text-[14px] font-medium text-ink-black hover:text-signal-orange cursor-pointer transition-colors">Design System Hosting</li>
                  <li className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-ink-black hover:text-signal-orange cursor-pointer transition-colors">Figma Webhooks</span>
                    <span className="bg-black/5 text-black/60 text-[10px] px-1.5 py-0.5 rounded-sm font-gtstandardmono">SOON</span>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end center"]
  });

  const displayValue = useTransform(scrollYProgress, [0, 1], [0, value]);

  useMotionValueEvent(displayValue, "change", (latest) => {
    if (ref.current) {
      ref.current.textContent = Math.round(latest).toLocaleString();
    }
  });

  return <span ref={ref}>0</span>;
}

export function HomeStudio() {
  const router = useRouter();
  const { status: authStatus, openAuth } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [markdown, setMarkdown] = useState("");
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingName, setGeneratingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentUpload[]>([]);
  const [batchResults, setBatchResults] = useState<ImportResult[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [activeLogoIndex, setActiveLogoIndex] = useState<number | null>(null);
  const [showRecent, setShowRecent] = useState(false);
  const [heroTab, setHeroTab] = useState<HeroTabId>("wiki");

  // Smooth Scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  const parserMode = useMemo(() => {
    if (!markdown.trim()) return "Auto-detect";
    return isApolloStructuredMarkdown(markdown)
      ? "Structured design wiki"
      : "Section wiki";
  }, [markdown]);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/wiki/import");
      if (!res.ok) {
        setRecent([]);
        return;
      }
      const data = await res.json();
      setRecent(data.uploads ?? []);
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authed" || authStatus === "unconfigured") {
      loadRecent();
    } else {
      setRecent([]);
    }
  }, [loadRecent, authStatus]);

  const blockedBySignIn = (): boolean => {
    if (authStatus === "authed" || authStatus === "unconfigured") return false;
    if (authStatus === "loading") {
      setError("Checking your sign-in… one moment.");
      return true;
    }
    setError("Sign in to upload — your design files stay private to your team.");
    openAuth("signin");
    return true;
  };

  const importMarkdown = async (text: string, name?: string) => {
    const res = await fetch("/api/wiki/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: text, fileName: name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Import failed");
    return data as ImportResult & { docRef: string };
  };

  const goToWiki = async (result: ImportResult) => {
    const name = result.systemName ?? result.label;
    setGeneratingName(name);
    markWikiBuilding(result.docRef, name);

    const path =
      result.wikiUrl.replace(/^https?:\/\/[^/]+/, "") ||
      `/wiki?doc=${encodeURIComponent(result.docRef)}`;

    await new Promise((r) => setTimeout(r, 1200));
    router.push(path);
  };

  const handleGenerate = async () => {
    if (!markdown.trim()) {
      setError("Paste your markdown or attach a .md file first.");
      return;
    }
    if (blockedBySignIn()) return;
    setLoading(true);
    setError(null);
    setBatchResults([]);
    try {
      const result = await importMarkdown(markdown, fileLabel ?? undefined);
      await goToWiki(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = async (files: FileList | File[], multiOnly = false) => {
    const mdFiles = Array.from(files).filter((f) =>
      f.name.toLowerCase().endsWith(".md"),
    );
    if (mdFiles.length === 0) {
      setError("Only .md files are supported.");
      return;
    }
    if (blockedBySignIn()) return;

    setLoading(true);
    setError(null);

    try {
      if (!multiOnly && mdFiles.length === 1) {
        const text = await mdFiles[0].text();
        setMarkdown(text);
        setFileLabel(mdFiles[0].name);
        setHeroTab("wiki");
        const result = await importMarkdown(text, mdFiles[0].name);
        await goToWiki(result);
        return;
      }

      const results: ImportResult[] = [];
      for (const file of mdFiles) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/wiki/import", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Failed: ${file.name}`);
        results.push(data);
      }
      setBatchResults(results);
      await loadRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      void handleFiles(e.dataTransfer.files, e.dataTransfer.files.length > 1);
    }
  };

  const handleHeroSubmit = () => {
    if (heroTab === "wiki") {
      void handleGenerate();
      return;
    }
    if (heroTab === "scan") {
      document.getElementById("start")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (heroTab === "pipeline") {
      router.push("/wiki/pipeline?doc=apollo.md");
      return;
    }
    router.push("/wiki/sync?doc=apollo.md");
  };

  return (
    <div
      className={`min-h-screen bg-paper-white text-ink-black font-plain${dragOver ? " opacity-50" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* Top Header & Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 flex flex-col">
        {/* Announcement Banner */}
        <div className="bg-signal-orange w-full py-2.5 px-4 flex items-center justify-center text-center">
          <p className="text-paper-white text-[13px] font-medium tracking-wide">
            New: BlockSmith Lab — build UI with your agent, against a design system that says no. <Link href="/lab" className="underline underline-offset-4 decoration-white/50 hover:decoration-white font-semibold ml-2">OPEN THE LAB <IconArrowRight size={12} className="inline-block" /></Link>
          </p>
        </div>

        {/* Main Nav */}
        <nav className="bg-paper-white border-b border-dashed border-black px-6 lg:px-12 py-5 flex items-center justify-center">
          <div className="max-w-[1200px] w-full flex items-center justify-between">
            {/* Left Section: Logo & Nav Links */}
            <div className="flex items-center gap-12 xl:gap-20">
              <Link href="/" className="flex items-center gap-2 text-ink-black font-medium">
                <span className="w-6 h-6 rounded-[3px] bg-ink-black flex items-center justify-center text-paper-white font-planar text-sm leading-none pt-[2px]">B</span>
                <span className="font-planar text-[22px] tracking-tight">BlockSmith</span>
              </Link>

              <div className="hidden lg:flex items-center gap-6 xl:gap-10 h-full">
                <NavMegaMenu label="Product" />
                {NAV.map((item) =>
                  item.href.startsWith("#") ? (
                    <a key={item.label} href={item.href} className="text-base font-medium text-ink-black hover:opacity-70 transition-opacity flex items-center gap-1.5 px-4 py-2 rounded-[3px] hover:bg-black/5">
                      {item.label}
                    </a>
                  ) : (
                    <Link key={item.label} href={item.href} className="text-base font-medium text-ink-black hover:opacity-70 transition-opacity flex items-center gap-1.5 px-4 py-2 rounded-[3px] hover:bg-black/5">
                      {item.label}
                    </Link>
                  ),
                )}
              </div>
            </div>

            {/* Right Section: Socials & Auth */}
            <div className="flex items-center gap-8 xl:gap-10">
              <a href="https://github.com/your-org/blocksmith" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[14px] font-medium text-ink-black hover:opacity-70 transition-opacity hidden md:flex">
                <svg height="18" aria-hidden="true" viewBox="0 0 16 16" version="1.1" width="18" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                </svg>
                <span className="hidden xl:inline">GitHub</span>
              </a>
              <AuthChrome variant="home" />
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Full Bleed */}
      <section className="relative pt-[160px] min-h-screen w-full overflow-hidden border-b border-solid border-white [border-image:repeating-linear-gradient(to_right,#ffffff_0,#ffffff_6px,transparent_6px,transparent_12px)_1]">
        <HeroAscii />
        
        <div className="relative z-10 max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2">
          {/* Left Column - Grid Layout */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col text-left w-full border-x border-solid border-white [border-image:repeating-linear-gradient(to_bottom,#ffffff_0,#ffffff_6px,transparent_6px,transparent_12px)_1]"
          >
            {/* Headline Cell */}
            <div className="border-b border-solid border-white [border-image:repeating-linear-gradient(to_right,#ffffff_0,#ffffff_6px,transparent_6px,transparent_12px)_1] px-6 lg:px-12 pt-16 pb-10 overflow-visible">
              <h1 className="font-gtplanar text-[60px] lg:text-[72px] leading-[1.05] tracking-[-0.04em] text-white">
                Power AI <br /> agents with <br />
                <div className="mt-4 leading-[1.25]">
                  <span className="bg-signal-orange text-white px-4 py-1 box-decoration-clone rounded-[4px] font-gtplanar">
                    governed <br />
                    design truth
                  </span>
                </div>
              </h1>
            </div>

            {/* Prompt Box Cell */}
            <div className="border-b border-solid border-white [border-image:repeating-linear-gradient(to_right,#ffffff_0,#ffffff_6px,transparent_6px,transparent_12px)_1] px-6 lg:px-12 py-8">
              <div className="w-full max-w-[500px] bg-paper-white rounded-xl shadow-lg overflow-hidden border border-white/10 z-10 relative">
                <div className="p-4 bg-paper-white text-left">
                  <HomeHeroChat
                    tab={heroTab}
                    onTabChange={setHeroTab}
                    markdown={markdown}
                    onMarkdownChange={(v) => {
                      setMarkdown(v);
                      setError(null);
                    }}
                    onSubmit={handleHeroSubmit}
                    loading={loading}
                    parserMode={parserMode}
                    onAttachClick={() => fileInputRef.current?.click()}
                    fileLabel={fileLabel}
                  />
                </div>
              </div>
            </div>

            {/* Buttons Cell */}
            <div className="px-6 lg:px-12 py-8 flex flex-wrap items-center gap-4">
              <Link href="#start" className="btn-slide bg-white text-black font-plain font-medium text-[14px] tracking-wide px-[24px] py-[12px] rounded-none">
                GET STARTED <IconArrowRight size={14} className="inline ml-1" />
              </Link>
              <Link href="/demo/investor" className="btn-slide bg-transparent border border-white text-white font-plain font-medium text-[14px] tracking-wide px-[24px] py-[12px] rounded-none flex items-center gap-2">
                TALK TO AN ENGINEER <IconArrowRight size={14} />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="w-full h-full flex items-end justify-end relative pt-8 pb-16 px-6 lg:px-12 border-l border-solid border-white [border-image:repeating-linear-gradient(to_bottom,#ffffff_0,#ffffff_6px,transparent_6px,transparent_12px)_1] lg:border-l-0 overflow-hidden"
          >
            {/* Swapped Subtext Cell */}
            <div className="max-w-[500px] z-10 mb-8 text-right translate-x-[5%]">
              <p className="font-plain text-[20px] leading-[1.6] text-white/90 tracking-[-0.005em]">
                Approve your design system in the browser. Developers pull what&apos;s promoted.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Logo Marquee */}
      <section className="bg-paper-white w-full border-b border-dashed border-black relative" aria-label="Trusted by">
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 relative border-l border-dashed border-black">
          {TRUSTED_LOGOS.slice(0, 10).map((logo, i) => (
            <div 
              key={`${logo.name}-${i}`} 
              onMouseEnter={() => setActiveLogoIndex(i)}
              onMouseLeave={() => setActiveLogoIndex(null)}
              className={`relative cursor-pointer border-r border-b border-dashed border-black h-[120px] px-8 flex items-center justify-center transition-colors group ${activeLogoIndex === i ? "bg-signal-orange" : "bg-transparent hover:bg-black/5"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={logo.src} 
                alt={logo.name} 
                className={`h-10 transition-all ${activeLogoIndex === i ? "brightness-0 invert opacity-100" : "opacity-80 group-hover:opacity-100"}`} 
              />
              
              {activeLogoIndex === i && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-[100%] left-[-1px] w-[320px] z-50 bg-signal-orange text-paper-white p-6 shadow-2xl"
                  style={{ border: "1px solid black" }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="mb-4 opacity-100">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                  </svg>
                  <p className="font-plain text-[18px] leading-[1.5] font-medium tracking-tight">
                    {logo.quote}
                  </p>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases Section */}
      <HomeUseCases />

      {/* Features Grid */}
      <section id="features" className="py-[96px] bg-paper-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-[64px]"
          >
            <p className="font-gtstandardmono text-caption uppercase tracking-[0.06em] text-ink-black mb-4">Developer first</p>
            <h2 className="font-gtplanar text-heading-lg tracking-[-0.02em] text-ink-black mb-6">
              Start governing <span className="inline-block bg-signal-orange px-2 rounded-[2px]">design today</span>
            </h2>
            <p className="font-plain text-subheading text-graphite max-w-[600px] mx-auto">
              The control plane between Figma, your repo, and your agents.
            </p>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-4 lg:h-[640px]">
            {FEATURES.map((f, i) => (
              <motion.article 
                key={f.tag}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.1 }}
                className="bg-lavender-mist rounded-[4px] overflow-hidden flex-1 lg:hover:flex-[3] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] border border-lavender-mist relative group flex flex-col"
              >
                <div className="p-6 flex flex-col h-full w-full">
                  {/* ASCII Inside Card */}
                  <div className="bg-ink-black text-signal-orange rounded-[3px] h-[160px] mb-6 overflow-hidden flex items-center justify-center p-4 shrink-0 transition-all duration-500">
                    <pre className="font-mono text-[24px] leading-[1.2] whitespace-pre text-center font-bold">
                      {f.ascii}
                    </pre>
                  </div>

                  <span className="font-gtstandardmono text-caption tracking-[0.06em] uppercase text-ink-black mb-2">{f.tag}</span>
                  <h3 className="font-gtplanar text-subheading tracking-[-0.01em] text-ink-black mb-3 leading-[1.1]">{f.title}</h3>
                  <p className="font-plain text-body text-graphite mb-6 flex-1">{f.body}</p>
                  
                  <Link
                    href={i === 0 ? "#start" : "/wiki?doc=apollo.md"}
                    className="bg-ink-black text-paper-white font-plain font-medium text-[16px] px-[21px] py-[8px] rounded-full hover:opacity-90 transition-opacity w-fit mt-auto shrink-0"
                  >
                    Learn more
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Developers - Two Column API Block */}
      <section id="developers" className="pt-[96px] pb-[260px] bg-faint-slate border-y border-lavender-mist relative overflow-hidden">
        {/* Absolute image flush to the right and bottom */}
        <div className="absolute right-0 bottom-0 w-[500px] lg:w-[600px] xl:w-[750px] pointer-events-none hidden lg:block z-0 flex items-end justify-end">
          <img src="/computer-screen.png" alt="Agents retro computer" className="w-full h-auto object-contain object-right-bottom mix-blend-multiply" />
        </div>

        <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-[32px] items-start relative z-10">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-7 bg-sky-tint rounded-[4px] p-6 border border-lavender-mist shadow-sm"
          >
            <CodeBlock
              code={CLI_SNIPPET}
              language="bash"
              filename="CLI"
            />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-5 pt-4 lg:pl-8"
          >
            <div className="relative z-10">
              <p className="font-gtstandardmono text-caption uppercase tracking-[0.06em] text-ink-black mb-4">MCP + CLI</p>
              <h2 className="font-gtplanar text-heading tracking-[-0.02em] text-ink-black mb-6 leading-[1.1]">
                Connect your agents <br />
                to <span className="inline-block bg-signal-orange text-white px-2 rounded-[2px]">pinned design truth</span>
              </h2>
              <p className="font-plain text-body text-graphite mb-8">
                One install. Agents and CI read only what you promoted.
              </p>
              <Link href="/protocol" className="text-ink-black font-plain font-medium underline underline-offset-4 hover:opacity-70 transition-opacity">
                View protocol docs <IconArrowRight size={14} className="inline ml-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <HomeTestimonials />

      {/* Animated Light Board Divider */}
      <AnimatedLightBoard />

      {/* Get Started Section */}
      <section id="start" className="bg-white relative border-t border-black/10 pt-16">
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 pointer-events-none max-w-[1400px] mx-auto flex justify-between z-0">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="w-[1px] h-full bg-black/5" />
          ))}
        </div>

        {/* Top Graphic Layout */}
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row relative z-10 border-b border-black/10 lg:min-h-[600px]">
          
          {/* Left Column */}
          <div className="w-full lg:w-1/2 flex flex-col justify-between pt-28 pb-0 lg:border-r border-black/10 relative">
            {/* Horizontal divider line in left column (matches screenshot) */}
            <div className="absolute top-[35%] left-0 right-0 h-[1px] bg-black/10 pointer-events-none"></div>

            <div className="px-6 lg:px-12 mb-auto pb-12">
              <h2 className="font-gtplanar text-[32px] md:text-[40px] font-bold leading-[1.3] text-black tracking-tight mb-8">
                <span className="bg-[#ffe4eb] px-1 py-0.5 inline-block mb-1">Get started.</span><br/>
                <span className="bg-[#ffe4eb] px-1 py-0.5 inline-block">Sync your design.</span>
              </h2>
              
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" className="bg-ink-black text-paper-white px-6 py-3 font-plain font-medium text-[15px] rounded-[4px] hover:bg-ink-black/80 transition-colors flex items-center gap-2">
                  Connect GitHub
                </button>
                <button type="button" className="bg-transparent border border-black/20 text-ink-black px-6 py-3 font-plain font-medium text-[15px] rounded-[4px] hover:bg-black/5 transition-colors">
                  Try demo
                </button>
              </div>
            </div>

            <div className="relative z-20 mt-32 lg:mt-auto pb-12">
              <div className="px-6 lg:px-12 flex items-center gap-2 mb-2">
                <div className="w-[10px] h-[10px] bg-[#ff00ff]"></div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-black font-bold">DESIGN TOKENS SYNCED</span>
                <span className="bg-[#cbe3f7] px-1.5 py-0.5 text-[10px] font-mono text-black font-bold">Today</span>
              </div>
              
              <div className="bg-[#c2d3e4] px-6 lg:px-12 py-3 lg:py-4 inline-flex relative z-10 -ml-2 lg:ml-6 border-b-8 border-white">
                <span className="font-gtplanar text-[64px] md:text-[120px] lg:text-[140px] leading-[0.8] tracking-tighter text-black font-medium">
                  <AnimatedNumber value={14592870} />
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Image */}
          <div className="w-full lg:w-1/2 relative min-h-[400px] lg:min-h-full border-t lg:border-t-0 border-black/10">
            <div className="absolute inset-0 bg-cover bg-bottom bg-no-repeat z-10" style={{ backgroundImage: "url('/final-footer.png')" }} />
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown"
          multiple
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            if (e.target.files?.length) {
              void handleFiles(e.target.files, e.target.files.length > 1);
            }
            e.target.value = "";
          }}
        />

        {/* Recent Uploads Section */}
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 relative z-10">
          {recent.length > 0 ? (
            <div className="bg-faint-slate border border-lavender-mist rounded-[4px] p-6 text-left max-w-[800px]">
              <button
                type="button"
                className="font-gtstandardmono text-caption uppercase tracking-[0.06em] text-ink-black flex items-center justify-between w-full"
                onClick={() => setShowRecent((v) => !v)}
              >
                <span>Recent uploads ({recent.length})</span>
                <IconArrowRight
                  size={16}
                  className={`transform transition-transform ${showRecent ? "rotate-90" : ""}`}
                />
              </button>
              {showRecent ? (
                <ul className="flex flex-col gap-2 mt-4">
                  {recent.slice(0, 12).map((u) => (
                    <li key={u.docRef}>
                      <Link
                        href={`/wiki?doc=${encodeURIComponent(u.docRef)}`}
                        className="flex items-center justify-between p-3 bg-paper-white border border-lavender-mist rounded-[3px] hover:bg-faint-slate transition-colors"
                      >
                        <span className="font-plain text-ink-black">{u.label}</span>
                        <span className="font-gtstandardmono text-caption text-graphite">
                          {(u.bytes / 1024).toFixed(1)} KB
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* Big Dark Footer */}
      <footer className="bg-black text-white relative pt-32 pb-40 overflow-hidden border-t border-white/10 font-plain">
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 pointer-events-none max-w-[1400px] mx-auto flex justify-between z-0 px-4 lg:px-8">
          <div className="w-[1px] h-full border-l border-dashed border-white/20" />
          <div className="w-[1px] h-full border-r border-dashed border-white/20" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-[1px] border-t border-dashed border-white/20" />

        <div className="max-w-[1400px] mx-auto px-10 lg:px-24 relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 lg:gap-8">
          
          {/* Logo & Socials - spans 2 cols */}
          <div className="col-span-1 lg:col-span-2 flex flex-col gap-8">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-white text-black flex items-center justify-center font-gtplanar text-sm rounded-sm font-bold">B</span>
              <span className="font-gtplanar text-xl tracking-tight font-medium">BlockSmith</span>
            </div>
            
            <div className="flex items-center gap-4 text-white/50">
               <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 hover:text-white transition-colors cursor-pointer"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
               <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 hover:text-white transition-colors cursor-pointer"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
               <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 hover:text-white transition-colors cursor-pointer"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </div>
          </div>

          {/* Links Col 1 */}
          <div className="col-span-1 flex flex-col gap-10">
            <div>
              <h4 className="text-white/50 text-[13px] mb-4">Product</h4>
              <ul className="flex flex-col gap-3 text-[13px] text-white/80">
                <li className="hover:text-white cursor-pointer transition-colors">Token Synchronization</li>
                <li className="hover:text-white cursor-pointer transition-colors">Component Mapping</li>
                <li className="hover:text-white cursor-pointer transition-colors">Pipeline CI/CD</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white/50 text-[13px] mb-4">Platform</h4>
              <ul className="flex flex-col gap-3 text-[13px] text-white/80">
                <li className="hover:text-white cursor-pointer transition-colors">Custom Parsers</li>
                <li className="hover:text-white cursor-pointer transition-colors">Git Integration</li>
                <li className="hover:text-white cursor-pointer transition-colors">Multi-repo</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white/50 text-[13px] mb-4">Deployment</h4>
              <ul className="flex flex-col gap-3 text-[13px] text-white/80">
                <li className="hover:text-white cursor-pointer transition-colors">Cloud</li>
                <li className="hover:text-white cursor-pointer transition-colors">Self-hosted</li>
                <li className="hover:text-white cursor-pointer transition-colors">Hybrid</li>
              </ul>
            </div>
          </div>

          {/* Links Col 2 */}
          <div className="col-span-1 flex flex-col gap-10">
            <div>
              <h4 className="text-white/50 text-[13px] mb-4">Design engineering</h4>
              <ul className="flex flex-col gap-3 text-[13px] text-white/80">
                <li className="hover:text-white cursor-pointer transition-colors">Design Systems</li>
                <li className="hover:text-white cursor-pointer transition-colors">Design to Code</li>
                <li className="hover:text-white cursor-pointer transition-colors">Governance</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white/50 text-[13px] mb-4">Integrations</h4>
              <ul className="flex flex-col gap-3 text-[13px] text-white/80">
                <li className="hover:text-white cursor-pointer transition-colors">Figma</li>
                <li className="hover:text-white cursor-pointer transition-colors">React / Next.js</li>
                <li className="hover:text-white cursor-pointer transition-colors">Tailwind CSS</li>
                <li className="hover:text-white cursor-pointer transition-colors">Storybook</li>
              </ul>
            </div>
          </div>

          {/* Links Col 3 */}
          <div className="col-span-1 flex flex-col gap-10">
            <div>
              <h4 className="text-white/50 text-[13px] mb-4">Developer</h4>
              <ul className="flex flex-col gap-3 text-[13px] text-white/80">
                <li className="hover:text-white cursor-pointer transition-colors">API Reference</li>
                <li className="hover:text-white cursor-pointer transition-colors">Documentation</li>
                <li className="hover:text-white cursor-pointer transition-colors">Changelog</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white/50 text-[13px] mb-4">Resources</h4>
              <ul className="flex flex-col gap-3 text-[13px] text-white/80">
                <li className="hover:text-white cursor-pointer transition-colors">Guides</li>
                <li className="hover:text-white cursor-pointer transition-colors">Blog</li>
                <li className="hover:text-white cursor-pointer transition-colors">Customers</li>
                <li className="hover:text-white cursor-pointer transition-colors">Partners</li>
                <li className="hover:text-white cursor-pointer transition-colors">About us</li>
              </ul>
            </div>
          </div>

          {/* Links Col 4 */}
          <div className="col-span-1 flex flex-col gap-10">
            <div>
              <h4 className="text-white/50 text-[13px] mb-4">Popular frameworks</h4>
              <ul className="flex flex-col gap-3 text-[13px] text-white/80">
                <li className="hover:text-white cursor-pointer transition-colors">Next.js 15</li>
                <li className="hover:text-white cursor-pointer transition-colors">Vite</li>
                <li className="hover:text-white cursor-pointer transition-colors">Remix</li>
                <li className="hover:text-white cursor-pointer transition-colors">Vue / Nuxt</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white/50 text-[13px] mb-4">Legal</h4>
              <ul className="flex flex-col gap-3 text-[13px] text-white/80">
                <li className="hover:text-white cursor-pointer transition-colors">Terms and Conditions</li>
                <li className="hover:text-white cursor-pointer transition-colors">Privacy Policy</li>
                <li className="hover:text-white cursor-pointer transition-colors">Service Level Agreement</li>
              </ul>
            </div>
          </div>
          
        </div>
      </footer>

      <WikiGeneratingOverlay
        open={loading || generatingName !== null}
        systemName={generatingName ?? fileLabel ?? undefined}
      />
    </div>
  );
}
