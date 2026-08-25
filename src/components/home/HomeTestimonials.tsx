import React from "react";
import Link from "next/link";
import { IconArrowRight } from "@/components/icons/streamline";

const TESTIMONIALS = [
  {
    company: "Acme Corp",
    quote: "I want the best possible experience for our users, but also for our company. BlockSmith has hands down provided both. We really appreciate the level of commitment and support from your entire team.",
    author: "JANE DOE",
    role: "CO-FOUNDER, ACME CORP",
    highlight: false,
  },
  {
    company: "TechFlow",
    quote: "With BlockSmith, we gained a lot of control over our entire design pipeline and worked with their team to optimize each step.",
    author: "JOHN SMITH",
    role: "CTO, TECHFLOW",
    highlight: true,
  },
  {
    company: "DesignOps Inc",
    quote: "With BlockSmith's design sync, we immediately saw 3x speed improvements in our handoff. Engineers rely on speed when building, and that improvement has been critical to our product experience.",
    author: "ALICE JOHNSON",
    role: "FULL STACK ENGINEER",
    highlight: false,
  },
  {
    company: "ScaleUp",
    quote: "With the launch of our new dashboard we've discovered how addictive perfect design sync is - we use it every day and want it everywhere.",
    author: "MARK WILLIAMS",
    role: "VP OF PRODUCT, SCALEUP",
    highlight: false,
  },
  {
    company: "CreativeCloud",
    quote: "Managing design tokens across platforms could be a major headache. Thanks to BlockSmith, we're shipping cost-effective high-performance UI without any extra burden on our internal team.",
    author: "SARAH LEE",
    role: "LEAD DESIGNER",
    highlight: false,
  }
];

export function HomeTestimonials() {
  return (
    <section className="bg-paper-white relative overflow-hidden pt-[120px] pb-[60px]">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Main Grid container with top and left borders to complete the grid lines */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-dashed border-black/20">
          
          {/* Row 1 */}
          <div className="relative p-8 lg:p-12 min-h-[320px] border-b border-r border-dashed border-black/20 flex flex-col justify-between group bg-[#fff8f5] hover:bg-signal-orange transition-colors duration-300 cursor-pointer">
            <div>
              <h3 className="font-gtplanar text-2xl font-bold mb-6 group-hover:text-white transition-colors">Acme Corp</h3>
              <p className="font-plain text-[16px] leading-[1.6] text-graphite mb-8 group-hover:text-white transition-colors">
                &quot;{TESTIMONIALS[0].quote}&quot;
              </p>
            </div>
            <div className="flex items-center gap-3 mt-auto">
              <div className="w-10 h-10 rounded-full bg-black/10 shrink-0 overflow-hidden group-hover:bg-white/20 transition-colors"></div>
              <div>
                <p className="font-gtstandardmono text-[11px] uppercase tracking-wider font-bold text-ink-black group-hover:text-white transition-colors">{TESTIMONIALS[0].author}</p>
                <p className="font-gtstandardmono text-[11px] uppercase tracking-wider text-graphite group-hover:text-white transition-colors">{TESTIMONIALS[0].role}</p>
              </div>
            </div>
          </div>

          <div className="relative p-8 lg:p-12 min-h-[320px] border-b border-r border-dashed border-black/20 bg-[#ffefe8] hover:bg-signal-orange transition-colors duration-300 cursor-pointer flex flex-col justify-between group">
            <div>
              <h3 className="font-gtplanar text-2xl font-bold mb-6 group-hover:text-white transition-colors">TechFlow</h3>
              <p className="font-plain text-[16px] leading-[1.6] text-graphite mb-8 group-hover:text-white transition-colors">
                &quot;{TESTIMONIALS[1].quote}&quot;
              </p>
            </div>
            <div className="flex items-center gap-3 mt-auto">
              <div className="w-10 h-10 rounded-full bg-black/10 shrink-0 group-hover:bg-white/20 transition-colors"></div>
              <div>
                <p className="font-gtstandardmono text-[11px] uppercase tracking-wider font-bold text-ink-black group-hover:text-white transition-colors">{TESTIMONIALS[1].author}</p>
                <p className="font-gtstandardmono text-[11px] uppercase tracking-wider text-graphite group-hover:text-white transition-colors">{TESTIMONIALS[1].role}</p>
              </div>
            </div>
          </div>

          <div className="border-b border-r border-dashed border-black/20 hidden lg:flex bg-paper-white relative items-center justify-center overflow-hidden">
            <img src="/testimonial-art.jpeg" alt="Decorative quote icon" className="w-full h-full object-cover" />
          </div>

          {/* Row 2 */}
          <div className="p-8 lg:p-12 min-h-[320px] border-b border-r border-dashed border-black/20 md:col-span-2 flex flex-col justify-center bg-paper-white">
            <h2 className="font-gtplanar text-[56px] md:text-[72px] leading-[1.05] tracking-[-0.03em] text-ink-black mb-10 max-w-[700px]">
              What our customers are saying
            </h2>
            <div>
              <Link href="#" className="inline-flex items-center gap-2 border border-black/10 px-6 py-3 font-gtstandardmono text-[12px] uppercase tracking-wider text-ink-black hover:bg-signal-orange hover:text-white transition-colors duration-300">
                SEE ALL <IconArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="relative p-8 lg:p-12 min-h-[320px] border-b border-r border-dashed border-black/20 flex flex-col justify-between group bg-[#ffe6d9] hover:bg-signal-orange transition-colors duration-300 cursor-pointer">
            <div>
              <h3 className="font-gtplanar text-2xl font-bold mb-6 group-hover:text-white transition-colors">DesignOps Inc</h3>
              <p className="font-plain text-[16px] leading-[1.6] text-graphite mb-8 group-hover:text-white transition-colors">
                &quot;{TESTIMONIALS[2].quote}&quot;
              </p>
            </div>
            <div className="flex items-center gap-3 mt-auto">
              <div className="w-10 h-10 rounded-full bg-black/10 shrink-0 group-hover:bg-white/20 transition-colors"></div>
              <div>
                <p className="font-gtstandardmono text-[11px] uppercase tracking-wider font-bold text-ink-black group-hover:text-white transition-colors">{TESTIMONIALS[2].author}</p>
                <p className="font-gtstandardmono text-[11px] uppercase tracking-wider text-graphite group-hover:text-white transition-colors">{TESTIMONIALS[2].role}</p>
              </div>
            </div>
          </div>

          {/* Row 3 */}
          <div className="border-b lg:border-b-0 border-r border-dashed border-black/20 hidden lg:flex bg-paper-white relative items-center justify-center overflow-hidden">
            <img src="/cool.jpeg" alt="Decorative background" className="w-full h-full object-cover" />
          </div>

          <div className="relative p-8 lg:p-12 min-h-[320px] border-b md:border-b-0 border-r border-dashed border-black/20 flex flex-col justify-between group bg-[#ffdbcc] hover:bg-signal-orange transition-colors duration-300 cursor-pointer">
            <div>
              <h3 className="font-gtplanar text-2xl font-bold mb-6 group-hover:text-white transition-colors">ScaleUp</h3>
              <p className="font-plain text-[16px] leading-[1.6] text-graphite mb-8 group-hover:text-white transition-colors">
                &quot;{TESTIMONIALS[3].quote}&quot;
              </p>
            </div>
            <div className="flex items-center gap-3 mt-auto">
              <div className="w-10 h-10 rounded-full bg-black/10 shrink-0 group-hover:bg-white/20 transition-colors"></div>
              <div>
                <p className="font-gtstandardmono text-[11px] uppercase tracking-wider font-bold text-ink-black group-hover:text-white transition-colors">{TESTIMONIALS[3].author}</p>
                <p className="font-gtstandardmono text-[11px] uppercase tracking-wider text-graphite group-hover:text-white transition-colors">{TESTIMONIALS[3].role}</p>
              </div>
            </div>
          </div>

          <div className="relative p-8 lg:p-12 min-h-[320px] border-b md:border-b-0 border-r border-dashed border-black/20 flex flex-col justify-between group bg-[#ffccb3] hover:bg-signal-orange transition-colors duration-300 cursor-pointer">
            <div>
              <h3 className="font-gtplanar text-2xl font-bold mb-6 text-black uppercase tracking-tighter group-hover:text-white transition-colors">CreativeCloud</h3>
              <p className="font-plain text-[16px] leading-[1.6] text-graphite mb-8 group-hover:text-white transition-colors">
                &quot;{TESTIMONIALS[4].quote}&quot;
              </p>
            </div>
            <div className="flex items-center gap-3 mt-auto">
              <div className="w-10 h-10 rounded-full bg-black/10 shrink-0 group-hover:bg-white/20 transition-colors"></div>
              <div>
                <p className="font-gtstandardmono text-[11px] uppercase tracking-wider font-bold text-ink-black group-hover:text-white transition-colors">{TESTIMONIALS[4].author}</p>
                <p className="font-gtstandardmono text-[11px] uppercase tracking-wider text-graphite group-hover:text-white transition-colors">{TESTIMONIALS[4].role}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
