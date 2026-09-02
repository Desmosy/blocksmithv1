"use client";

/**
 * Moiré Field — interference between wave sources.
 *
 * Ported from Koshish's ranch (koshish-portfolio/src/ranch, MIT) for the
 * landing hero. No state between frames: every point is a closed-form
 * function of its index and the clock. Each source emits rings at wavelength
 * `pitch`; a point's brightness is the sum of those ring functions, and
 * where two crests coincide the fringe appears. The bands are never drawn —
 * they are the interference itself.
 *
 * The hero wrapper below remixes the parameters on a timer, so the field
 * keeps reinventing itself without anyone touching it.
 */

import React, { useEffect, useRef, useState } from "react";

export interface MoireFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: number;
  sources?: number;
  pitch?: number;
  spread?: number;
  orbit?: number;
  swell?: number;
  period?: number;
  contrast?: number;
  alpha?: number;
  dotSize?: number;
  trail?: number;
  hue?: number;
  hueSpread?: number;
  chroma?: number;
  zoom?: number;
  drift?: number;
  paused?: boolean;
  background?: string;
}

const TAU = Math.PI * 2;
const G1 = 0.7548776662466927;
const G2 = 0.5698402909980533;
const BANDS = 6;
const frac = (v: number) => v - Math.floor(v);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function MoireField({
  density = 90000,
  sources = 2,
  pitch = 0.045,
  spread = 0.42,
  orbit = 0.05,
  swell = 0.25,
  period = 18,
  contrast = 0.55,
  alpha = 1,
  dotSize = 1,
  trail = 0,
  hue = 196,
  hueSpread = 60,
  chroma = 0,
  zoom = 1,
  drift = 0,
  paused = false,
  background = "#000000",
  className,
  style,
  ...props
}: MoireFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const live = useRef({
    density, sources, pitch, spread, orbit, swell, period, contrast, alpha,
    dotSize, trail, hue, hueSpread, chroma, zoom, drift, paused, background,
  });
  useEffect(() => {
    live.current = {
      density, sources, pitch, spread, orbit, swell, period, contrast, alpha,
      dotSize, trail, hue, hueSpread, chroma, zoom, drift, paused, background,
    };
  }, [
    density, sources, pitch, spread, orbit, swell, period, contrast, alpha,
    dotSize, trail, hue, hueSpread, chroma, zoom, drift, paused, background,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let needsClear = true;

    const resize = () => {
      w = Math.max(1, container.clientWidth);
      h = Math.max(1, container.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      needsClear = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(container);

    const pointer = { x: 0, y: 0, active: false };
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);

    const sx = new Float64Array(8);
    const sy = new Float64Array(8);

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const draw = (dt: number) => {
      const s = live.current;
      if (!s.paused) t += dt;

      const keep = needsClear ? 0 : Math.min(Math.max(s.trail, 0), 0.98);
      needsClear = false;
      ctx.globalAlpha = 1;
      if (keep <= 0) {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = s.background;
        ctx.fillRect(0, 0, w, h);
      } else {
        const g = Math.round(255 * (1 - keep));
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(0, 0, w, h);
      }

      const cx = w / 2;
      const cy = h / 2;
      const scale = (Math.min(w, h) / 2) * Math.max(s.zoom, 0.05);

      // Sources sit on a slowly turning ring; the cursor joins as one more.
      let n = Math.max(1, Math.min(6, Math.round(s.sources)));
      const turn = t * s.orbit * TAU;
      for (let k = 0; k < n; k++) {
        const a = turn + (k / n) * TAU;
        sx[k] = Math.cos(a) * s.spread;
        sy[k] = Math.sin(a) * s.spread;
      }
      if (s.drift > 0 && pointer.active && n < 8) {
        sx[n] = pointer.x * s.drift;
        sy[n] = pointer.y * s.drift;
        n += 1;
      }

      // The wavelength breathes, which is what sweeps the fringes in and out.
      const breath = 1 + s.swell * Math.sin((t / Math.max(s.period, 0.5)) * TAU);
      const k = TAU / Math.max(0.002, s.pitch * breath);
      const total = Math.min(220000, Math.max(1000, Math.round(s.density)));
      const dot = Math.max(0.5, s.dotSize);
      const sat = Math.round(clamp01(s.chroma) * 80);
      const light = 62 + (1 - clamp01(s.chroma)) * 38;
      const cut = 1 - clamp01(s.contrast);

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(Math.max(s.alpha, 0.02), 1);

      const bandLen = Math.max(1, Math.floor(total / BANDS));
      for (let band = 0; band < BANDS; band++) {
        ctx.fillStyle = `hsl(${(s.hue + s.hueSpread * (band / (BANDS - 1))).toFixed(1)} ${sat}% ${light.toFixed(0)}%)`;
        const from = band * bandLen;
        const to = band === BANDS - 1 ? total : from + bandLen;
        for (let i = from; i < to; i++) {
          // An even scatter over the frame, then keep only the points the
          // interference lights up. Rejection is the render.
          const ux = frac(0.5 + i * G1) * 2 - 1;
          const uy = frac(0.5 + i * G2) * 2 - 1;
          let sum = 0;
          for (let j = 0; j < n; j++) {
            const dx = ux - sx[j];
            const dy = uy - sy[j];
            sum += Math.cos(Math.sqrt(dx * dx + dy * dy) * k);
          }
          const v = sum / n;
          if (v < cut) continue;
          ctx.fillRect(cx + ux * scale - dot * 0.5, cy + uy * scale - dot * 0.5, dot, dot);
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (now: number) => {
      const step = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (visible) draw(step);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", background, ...style }}
      {...props}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}

type RemixParams = {
  sources: number;
  pitch: number;
  spread: number;
  orbit: number;
  swell: number;
  period: number;
  contrast: number;
  hue: number;
  hueSpread: number;
  chroma: number;
};

/** The opening look: two sources, white ink, fine fringes — quiet on black. */
const OPENING: RemixParams = {
  sources: 2,
  pitch: 0.03,
  spread: 0.42,
  orbit: 0.04,
  swell: 0.3,
  period: 16,
  contrast: 0.5,
  hue: 16,
  hueSpread: 24,
  chroma: 0,
};

/**
 * A new arrangement of the field. Half the time white ink (the hero is
 * monochrome), a quarter in the brand's orange family, the rest anywhere —
 * a remix should occasionally surprise.
 */
function remix(): RemixParams {
  const r = (min: number, max: number, digits = 3) =>
    +(min + Math.random() * (max - min)).toFixed(digits);
  const roll = Math.random();
  const inked = roll < 0.5;
  const hue = inked ? 16 : roll < 0.75 ? r(8, 28, 0) : Math.floor(Math.random() * 360);
  return {
    sources: Math.round(r(2, 5, 0)),
    pitch: r(0.018, 0.1),
    spread: r(0.15, 0.65),
    orbit: r(0.01, 0.12),
    swell: r(0.1, 0.7),
    period: r(8, 24, 1),
    contrast: r(0.35, 0.8),
    hue,
    hueSpread: inked ? 0 : r(0, 90, 0),
    chroma: inked ? 0 : r(0.45, 0.85),
  };
}

const REMIX_EVERY_MS = 12_000;

/**
 * The hero's ambient field: fills its parent, remixes itself on a timer,
 * and holds one still frame for anyone who prefers reduced motion.
 */
export default function MoireHero({ className }: { className?: string }) {
  const [params, setParams] = useState<RemixParams>(OPENING);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => setParams(remix()), REMIX_EVERY_MS);
    return () => clearInterval(timer);
  }, [still]);

  return (
    <MoireField
      {...params}
      density={120000}
      dotSize={1.5}
      zoom={1.35}
      drift={1}
      paused={still}
      background="#000000"
      className={className}
      // The field's root sets position:relative inline, which beats any
      // class — position it inline too so it actually fills the host cell.
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    />
  );
}
