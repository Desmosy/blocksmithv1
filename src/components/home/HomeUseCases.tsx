"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { motion } from "framer-motion";

const USE_CASES = [
  {
    id: "designers",
    title: "For Design Leads",
    description: "Define constraints in the wiki, not endless Figma specs. Spacing, type scales, and tokens — edited visually, stored as data.",
    code: `// Wiki edits instantly generate raw design tokens\n{\n  "colors": {\n    "signal-orange": "#ff4500",\n    "paper-white": "#ffffff"\n  },\n  "typography": {\n    "base": "16px",\n    "scale": 1.15\n  }\n}`,
  },
  {
    id: "developers",
    title: "For Frontend Engineers",
    description: "Stop hunting for hex codes. Pull approved tokens into your repo; CI catches drift.",
    code: `# Pull approved tokens into your repo\nblocksmith pull --env production\n\n# Validate your codebase against the design system in CI\nblocksmith check --fail-on-drift`,
  },
  {
    id: "agents",
    title: "For AI Agents",
    description: "An MCP server gives coding agents your UI rules — so they only write code that follows them.",
    code: `// MCP Tool Request: \n// "What are the rules for a primary button?"\n{\n  "tool": "get_design_rules",\n  "target": "PrimaryButton",\n  "response": {\n    "bg": "signal-orange",\n    "radius": "4px",\n    "padding": "12px 24px"\n  }\n}`,
  }
];

export function HomeUseCases() {
  const [activeId, setActiveId] = useState(USE_CASES[0].id);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the most visible entry intersecting near the top
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by top coordinate to find the highest one on screen
          visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-200px 0px -50% 0px", // Trigger when the section reaches top quarter of screen
        threshold: 0,
      }
    );

    const map = containerRefs.current;
    map.forEach((node) => observerRef.current?.observe(node));

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <section className="bg-paper-white w-full border-b border-dashed border-black relative">
      <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row relative">
        
        {/* Left Sidebar - Sticky */}
        <aside className="w-full lg:w-1/4 lg:border-r border-dashed border-black pt-32">
          <div className="sticky top-[160px] pb-8 px-6 lg:px-8">
            <h3 className="font-gtplanar text-xl text-ink-black tracking-[-0.02em] mb-8">Use Cases</h3>
            <nav className="flex flex-col gap-1 relative border-l-2 border-[#e5e7eb]">
              {USE_CASES.map((uc, i) => (
                <div key={uc.id} className="relative">
                  {activeId === uc.id && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute -left-[2px] top-0 bottom-0 w-[2px] bg-signal-orange"
                      transition={{ duration: 0.2 }}
                    />
                  )}
                  <a
                    href={`#${uc.id}`}
                    className={`block py-3 px-4 text-[15px] transition-colors ${
                      activeId === uc.id 
                        ? "text-ink-black font-semibold" 
                        : "text-graphite hover:text-ink-black"
                    }`}
                  >
                    {uc.title}
                  </a>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Right Content - Stacking Cards */}
        <div className="w-full lg:w-3/4 flex flex-col pt-32">
          {USE_CASES.map((uc, i) => {
            const isDarkActive = activeId === uc.id && i % 2 === 0;
            return (
              <div 
                key={uc.id} 
                id={uc.id}
                ref={(el) => {
                  if (el) containerRefs.current.set(uc.id, el);
                }}
                // Give each section enough height so scrolling happens smoothly
                className={`min-h-[80vh] w-full transition-colors duration-500 ${
                  isDarkActive ? "bg-ink-black" : "bg-transparent"
                }`}
              >
                {/* The sticky card itself */}
                <div 
                  className={`sticky w-full border-b lg:border-b-0 border-dashed border-black pt-32 pb-40 px-6 lg:px-16 transition-colors duration-500 ${
                    isDarkActive ? "bg-ink-black text-paper-white" : "bg-paper-white text-ink-black"
                  }`}
                  // Adding an offset based on index so they stack with a 1px gap, or just overlap exactly
                  // We overlap exactly at top-[160px] so the next card covers the previous completely
                  style={{ top: "160px" }}
                >
                  {/* Visual shadow/border for the stacking edge */}
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-black opacity-10" />

                  <div className="flex flex-col xl:flex-row gap-12 xl:gap-8 items-start">
                    
                    {/* Card Text Content */}
                    <div className="w-full lg:w-1/2">
                      <h4 className={`font-gtplanar text-[56px] leading-[1.05] tracking-[-0.03em] mb-8 transition-colors duration-500 ${
                        isDarkActive ? "text-paper-white" : "text-ink-black"
                      }`}>
                        {uc.title}
                      </h4>
                      <p className={`font-plain text-lg leading-[1.5] mb-10 max-w-[400px] transition-colors duration-500 ${
                        isDarkActive ? "text-white/80" : "text-graphite"
                      }`}>
                        {uc.description}
                      </p>
                      <div className="flex items-center gap-6">
                        <Link href="#learn-more" className={`btn-slide font-plain font-medium text-[14px] tracking-wide px-[24px] py-[12px] rounded-none transition-colors duration-500 ${
                          isDarkActive ? "bg-white text-black" : "bg-ink-black text-paper-white"
                        }`}>
                          Learn More
                        </Link>
                        <Link href="#try-now" className={`bg-transparent font-plain font-medium text-[14px] tracking-wide hover:underline underline-offset-4 transition-all duration-500 ${
                          isDarkActive ? "text-paper-white" : "text-ink-black"
                        }`}>
                          Try now
                        </Link>
                      </div>
                    </div>

                    {/* Card Code Window */}
                    <div className={`w-full xl:w-[450px] shrink-0 border rounded-xl shadow-sm overflow-hidden flex flex-col relative group transition-colors duration-500 ${
                      isDarkActive ? "bg-[#111111] border-white/10" : "bg-[#fafafa] border-black/10"
                    }`}>
                      <button className={`absolute top-4 right-4 p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border ${
                        isDarkActive ? "text-white/70 hover:text-white bg-black/50 border-white/10" : "text-graphite hover:text-ink-black bg-white border-black/5"
                      }`} aria-label="Copy code">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                      <div className="p-6 overflow-x-auto">
                        <pre className={`font-mono text-[13px] leading-[1.6] transition-colors duration-500 ${
                          isDarkActive ? "text-paper-white" : "text-ink-black"
                        }`}>
                          <code>
                            {uc.code.split("\n").map((line, idx) => (
                              <div key={idx} className="flex gap-4">
                                <span className="text-[#a1a1aa] select-none w-4 text-right shrink-0">{idx + 1}</span>
                                <span className="whitespace-pre">{line}</span>
                              </div>
                            ))}
                        </code>
                      </pre>
                    </div>
                  </div>

                </div>
              </div>
            </div>
            );
          })}
        </div>
        
      </div>
    </section>
  );
}
