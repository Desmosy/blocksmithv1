"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Paperclip, Sparkles } from "lucide-react";
import { IconLink, IconModuleAlt, IconUpload, IconColorPalette } from "@/components/icons";
import { AnimatePresence, motion } from "motion/react";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

const OPENAI_SVG = (
  <div className="flex-none">
    <svg aria-label="o3-mini icon" className="block dark:hidden" height="14" preserveAspectRatio="xMidYMid" viewBox="0 0 256 260" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z" /></svg>
    <svg aria-label="o3-mini icon" className="hidden dark:block" height="14" preserveAspectRatio="xMidYMid" viewBox="0 0 256 260" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z" fill="#fff" /></svg>
  </div>
);

const DEFAULT_MODELS = ["Claude 3.5 Sonnet", "GPT-4o", "Gemini 1.5 Pro"];

const MODEL_ICONS: Record<string, React.ReactNode> = {
  "GPT-4o": OPENAI_SVG,
  "Gemini 1.5 Pro": (
    <svg height="14" width="14" style={{ flex: "none", lineHeight: "1" }} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gemini-fill" x1="0%" x2="68.73%" y1="100%" y2="30.395%">
          <stop offset="0%" stopColor="#1C7DFF" />
          <stop offset="52.021%" stopColor="#1C69FF" />
          <stop offset="100%" stopColor="#F0DCD6" />
        </linearGradient>
      </defs>
      <path d="M12 24A14.304 14.304 0 000 12 14.304 14.304 0 0012 0a14.305 14.305 0 0012 12 14.305 14.305 0 00-12 12" fill="url(#gemini-fill)" fillRule="nonzero" />
    </svg>
  ),
  "Claude 3.5 Sonnet": (
    <div className="flex-none">
      <svg className="block dark:hidden" fill="#000" fillRule="evenodd" style={{ flex: "none", lineHeight: "1" }} viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
      </svg>
      <svg className="hidden dark:block" fill="#fff" fillRule="evenodd" style={{ flex: "none", lineHeight: "1" }} viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
      </svg>
    </div>
  ),
};

function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  return t.includes("\n") || /^#{1,6}\s/.test(t) || t.startsWith("---");
}

/**
 * One line, no spaces, and a dot with a plausible TLD after it.
 *
 * Checked before the markdown test so a bare "linear.app" is read as an
 * address rather than a design system called "linear.app". A name with a space
 * in it ("Acme Web") can never match, which is the common case to protect.
 */
function looksLikeSiteAddress(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^https?:\/\//i.test(t)) return true;
  // "design.md" is a filename people genuinely type here, and it parses as a
  // domain under .md (Moldova). File extensions win over the domain reading.
  if (/\.(md|markdown|json|ya?ml|txt|tsx?|jsx?|css|zip)$/i.test(t)) return false;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(t);
}

type Pending = null | "ai" | "plain" | "import" | "upload" | "image" | "capture";

export function PromptBar({ aiEnabled = false, greetingName }: { aiEnabled?: boolean; greetingName?: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 72,
    maxHeight: 300,
  });
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0]);

  const busy = pending !== null;
  const isMarkdown = looksLikeMarkdown(value);
  const isSite = looksLikeSiteAddress(value);

  const goToWiki = (wikiUrl: string) => {
    router.push(wikiUrl.replace(/^https?:\/\/[^/]+/, "") || "/dashboard");
  };

  const importMarkdown = async () => {
    if (!value.trim() || busy) return;
    setPending("import");
    setError(null);
    try {
      const res = await fetch("/api/wiki/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: value }),
      });
      const data = (await res.json()) as { wikiUrl?: string; error?: string };
      if (!res.ok || !data.wikiUrl) throw new Error(data.error || "Import failed");
      goToWiki(data.wikiUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setPending(null);
    }
  };

  const create = async (useAi: boolean) => {
    const text = value.trim();
    if (!text || busy) return;
    setPending(useAi ? "ai" : "plain");
    setError(null);
    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: text, useAi }),
      });
      const data = (await res.json()) as { wikiPath?: string; error?: string };
      if (!res.ok || !data.wikiPath) throw new Error(data.error || "Could not create project");
      goToWiki(data.wikiPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
      setPending(null);
    }
  };

  /**
   * Read a site into a design system.
   *
   * This lives here rather than in its own card because the bar is already the
   * one place you start from — it takes a name, a design.md, or now an address,
   * and works out which. A second panel underneath offering the same things was
   * just the same screen twice.
   */
  const captureSite = async () => {
    const text = value.trim();
    if (!text || busy) return;
    setPending("capture");
    setError(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: text }),
      });
      const data = (await res.json()) as { wikiPath?: string; error?: string };
      if (!res.ok || !data.wikiPath) throw new Error(data.error || "Could not read that site");
      goToWiki(data.wikiPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that site");
      setPending(null);
    }
  };

  const submitDefault = () => {
    if (isSite) void captureSite();
    else if (isMarkdown) void importMarkdown();
    else if (aiEnabled) void create(true);
    else void create(false);
  };

  const uploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".md")) {
      setError("Please choose a .md file.");
      return;
    }
    setPending("upload");
    setError(null);
    try {
      const markdown = await file.text();
      const res = await fetch("/api/wiki/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, fileName: file.name }),
      });
      const data = (await res.json()) as { wikiUrl?: string; error?: string };
      if (!res.ok || !data.wikiUrl) throw new Error(data.error || "Upload failed");
      goToWiki(data.wikiUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPending(null);
    }
  };

  const generateFromImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image (PNG, JPEG, or WebP).");
      return;
    }
    setPending("image");
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read the image."));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/projects/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = (await res.json()) as { wikiPath?: string; error?: string };
      if (!res.ok || !data.wikiPath) throw new Error(data.error || "Could not read that image");
      goToWiki(data.wikiPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image");
      setPending(null);
    }
  };

  const pill =
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[var(--dash-muted-fg)] transition-colors hover:bg-[var(--dash-muted)] hover:text-[var(--dash-foreground)] disabled:opacity-40 cursor-pointer";

  return (
    <div className={cn("w-full max-w-3xl mx-auto flex flex-col items-center mt-12 mb-12")}>
      <div className="mb-8 flex flex-col items-center text-center w-full">
        <h2 className="text-[28px] font-semibold tracking-tight text-ink-black mb-1 font-sans">
          {greetingName ? `Welcome back, ${greetingName}` : "Welcome back"}
        </h2>
        <p className="mt-1 text-[15px] text-graphite font-sans">
          Create, import, and govern every design system in one place.
        </p>
      </div>

      <div className="w-full relative overflow-hidden rounded-[24px] bg-[var(--dash-surface)] border border-[var(--dash-border)] shadow-lg transition-colors hover:border-[var(--dash-border-strong)]">
        <BorderBeam duration={8} size={250} />
        
        <div className="relative group z-10">
          <div className="relative flex flex-col">
            <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
              <Textarea
                className={cn(
                  "w-full resize-none rounded-[20px] rounded-b-none border-none bg-[var(--dash-muted)]/30 px-5 py-4 placeholder:text-[var(--dash-subtle-fg)] focus-visible:ring-0 focus-visible:ring-offset-0 text-[14px] text-[var(--dash-foreground)] font-sans leading-relaxed transition-colors group-hover:bg-[var(--dash-muted)]/50",
                  "min-h-[72px]"
                )}
                id="ai-input"
                onChange={(e) => {
                  setValue(e.target.value);
                  adjustHeight();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitDefault();
                  }
                }}
                placeholder={
                  aiEnabled
                    ? "Name a site to read — e.g. “linear.app” — describe a system, or paste a design.md…"
                    : "Name a site to read — e.g. “linear.app” — name a new system, or paste a design.md…"
                }
                ref={textareaRef}
                data-prompt-bar-input=""
                value={value}
                disabled={busy}
              />
            </div>

            <div className="flex h-14 items-center rounded-b-[20px] bg-[var(--dash-muted)]/30 transition-colors group-hover:bg-[var(--dash-muted)]/50">
              <div className="absolute right-3 bottom-3 left-3 flex w-[calc(100%-24px)] items-center justify-between">
                <div className="flex items-center gap-2">
                  {aiEnabled && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="flex h-8 items-center gap-1.5 rounded-lg pr-2 pl-2.5 text-xs hover:bg-[var(--dash-border)] focus-visible:ring-1 focus-visible:ring-[var(--dash-primary)] focus-visible:ring-offset-0 text-[var(--dash-foreground)] transition-colors"
                          variant="ghost"
                          disabled={busy}
                        >
                           <AnimatePresence mode="wait">
                            <motion.div
                              key={selectedModel}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              initial={{ opacity: 0, y: -5 }}
                              transition={{ duration: 0.15 }}
                              className="flex items-center gap-1.5"
                            >
                              {MODEL_ICONS[selectedModel] || <Sparkles className="h-4 w-4 opacity-50" />}
                              <span className="font-medium font-sans">{selectedModel}</span>
                              <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-0.5" />
                            </motion.div>
                          </AnimatePresence>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="min-w-[12rem] rounded-xl border-[var(--dash-border)] bg-[var(--dash-surface)] p-1.5 shadow-lg">
                        {DEFAULT_MODELS.map((model) => (
                          <DropdownMenuItem
                            key={model}
                            onSelect={() => setSelectedModel(model)}
                            className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] hover:bg-[var(--dash-muted)] focus:bg-[var(--dash-muted)]"
                          >
                            <div className="flex items-center gap-2">
                              {MODEL_ICONS[model] || <Sparkles className="h-4 w-4 opacity-50" />}
                              <span className="font-medium text-[var(--dash-foreground)]">{model}</span>
                            </div>
                            {selectedModel === model && <Check className="h-4 w-4 text-[var(--dash-primary)]" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {aiEnabled && <div className="mx-1 h-5 w-px bg-[var(--dash-border)]" />}
                  
                  <label
                    aria-label="Attach file"
                    className={cn(
                      "cursor-pointer rounded-lg p-2 transition-colors",
                      "hover:bg-[var(--dash-border)] focus-visible:ring-1 focus-visible:ring-[var(--dash-primary)] focus-visible:ring-offset-0",
                      "text-[var(--dash-muted-fg)] hover:text-[var(--dash-foreground)]",
                      busy && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <input 
                      className="hidden" 
                      type="file" 
                      accept=".md,text/markdown,image/png,image/jpeg,image/webp"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        if (file.name.toLowerCase().endsWith(".md")) {
                          void uploadFile(file);
                        } else if (file.type.startsWith("image/")) {
                          void generateFromImage(file);
                        } else {
                          setError("Unsupported file format");
                        }
                      }}
                    />
                    <Paperclip className="h-4.5 w-4.5" />
                  </label>
                  
                  {error && <span className="text-[12px] font-medium text-[var(--dash-destructive)] ml-2 truncate max-w-[200px]">{error}</span>}
                  {busy && <span className="text-[12px] font-medium text-[var(--dash-muted-fg)] ml-2">{pending === 'import' ? 'Importing...' : pending === 'ai' ? 'Generating...' : pending === 'upload' ? 'Uploading...' : 'Processing...'}</span>}
                </div>
                
                <button
                  aria-label="Send message"
                  className={cn(
                    "rounded-xl p-2.5 transition-all shadow-sm",
                    value.trim() && !busy
                      ? "bg-[var(--dash-primary)] text-[var(--dash-primary-foreground)] hover:bg-[var(--dash-primary-hover)] hover:shadow-md hover:-translate-y-px"
                      : "bg-[var(--dash-border)] text-[var(--dash-muted-fg)]",
                    "focus-visible:ring-2 focus-visible:ring-[var(--dash-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dash-surface)]"
                  )}
                  disabled={!value.trim() || busy}
                  type="button"
                  onClick={submitDefault}
                >
                  <ArrowRight
                    className={cn(
                      "h-4 w-4 transition-opacity duration-200",
                      value.trim() && !busy ? "opacity-100" : "opacity-60"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className={cn(pill, "bg-[var(--dash-surface)] border border-[var(--dash-border)] shadow-sm px-3 py-2")}
        >
          <IconUpload size={16} />
          {pending === "upload" ? "Uploading…" : "Upload .md"}
        </button>
        {aiEnabled && (
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={busy}
            className={cn(pill, "bg-[var(--dash-surface)] border border-[var(--dash-border)] shadow-sm px-3 py-2")}
          >
            <IconColorPalette size={16} />
            {pending === "image" ? "Reading image…" : "Screenshot"}
          </button>
        )}
        <Link href="/dashboard/connectors#figma" className={cn(pill, "bg-[var(--dash-surface)] border border-[var(--dash-border)] shadow-sm px-3 py-2")}>
          <IconLink size={16} />
          Import from Figma
        </Link>
        <Link href="/dashboard/connectors#codebase" className={cn(pill, "bg-[var(--dash-surface)] border border-[var(--dash-border)] shadow-sm px-3 py-2")}>
          <IconModuleAlt size={16} />
          Scan a repo
        </Link>
        <input
          ref={fileInput}
          type="file"
          accept=".md,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadFile(file);
          }}
        />
        <input
          ref={imageInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void generateFromImage(file);
          }}
        />
      </div>
    </div>
  );
}
