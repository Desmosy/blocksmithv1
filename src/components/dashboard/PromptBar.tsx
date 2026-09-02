"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, Paperclip } from "lucide-react";
import { IconLink, IconModuleAlt, IconUpload, IconColorPalette } from "@/components/icons";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";



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
      // A platform timeout answers with a text page, not JSON. Read the body
      // as text first so the failure is reported in words rather than as
      // "Unexpected token 'A'".
      const raw = await res.text();
      let data: { wikiPath?: string; error?: string } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        data = {
          error:
            res.status === 504 || /timeout/i.test(raw)
              ? "That page took too long to read. Try a lighter page on the same site, or run it again."
              : `The server answered with something unexpected (${res.status}).`,
        };
      }
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
