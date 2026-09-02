/**
 * Programmable graphics, generated from a design system's tokens.
 *
 * A decorative graphic that arrives as a PNG is a dead end: it cannot take a
 * new colour, cannot resize without blurring, and cannot be checked against
 * the system it sits in. Everything here is code — SVG, Canvas 2D, and a
 * WebGPU shader with a WebGL2 fallback — parameterised by the palette, so the
 * same graphic re-renders in any system and an agent can build the next one
 * the same way.
 *
 * Isomorphic on purpose: these return strings, so the wiki can render them and
 * the exported skill can hand them to an agent as copy-and-paste code.
 */

import type { DesignSystem } from "@/lib/blocks/types";

export type GraphicsPalette = {
  ground: string;
  ink: string;
  accent: string;
  /** Extra chromatic colours the system keeps for artwork. */
  sparks: string[];
};

export type Snippet = {
  id:
    | "svg-orb"
    | "svg-orbit"
    | "svg-dot-grid"
    | "svg-line-chart"
    | "svg-stacked-bars"
    | "canvas-field"
    | "shader-gradient"
    | "paper-mesh";
  title: string;
  language: "html" | "javascript" | "tsx";
  /** What it is for, in one line. */
  purpose: string;
  code: string;
  /**
   * Whether the snippet is a complete page that a sandboxed frame can run.
   * A React component is not; it is shown as code for the reader's project.
   */
  runnable: boolean;
  /** Shell line to run first, when the snippet depends on a package. */
  install?: string;
};

const HEX = /^#[0-9a-f]{6}$/i;

function chroma(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...v) - Math.min(...v);
}
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** Linear mix of two hex colours; t=0 is a, t=1 is b. */
function mix(a: string, b: string, t: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** Hex → "r, g, b" in 0..1, for shader literals. */
function vec3(hex: string): string {
  return [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(", ");
}

/**
 * Pick the colours a graphic should be made of.
 *
 * Roles are read first because capture and hand-written systems both name
 * them; chroma is the fallback. Sparks are the colours a system reserves for
 * artwork — the orange and violet elevenlabs never puts on a button — and
 * they are exactly what a decorative graphic should use.
 */
export function paletteForGraphics(system: DesignSystem): GraphicsPalette {
  const colors = system.colors.filter((c) => HEX.test(c.value));
  const byRole = (re: RegExp) => colors.find((c) => re.test(`${c.name} ${c.role ?? ""}`))?.value;
  const ground = byRole(/ground|canvas|background|paper|page/i) ?? colors.slice().sort((a, b) => luminance(b.value) - luminance(a.value))[0]?.value ?? "#ffffff";
  const ink = byRole(/\bink\b|primary text|text/i) ?? colors.slice().sort((a, b) => luminance(a.value) - luminance(b.value))[0]?.value ?? "#111111";
  const chromatic = colors.filter((c) => chroma(c.value) >= 60 && c.value !== ground && c.value !== ink);
  const accent = byRole(/accent|interactive|primary action|brand/i) ?? chromatic[0]?.value ?? ink;
  const sparks = [
    ...new Set(
      colors
        .filter((c) => /decorative|artwork|visual|spark|illustration/i.test(c.role ?? "") || chroma(c.value) >= 60)
        .map((c) => c.value)
        .filter((v) => v !== ground && v !== ink && v !== accent),
    ),
  ].slice(0, 3);
  // A single-accent system still needs three colours to make a graphic that
  // has depth. Derive them from what it has: the accent pulled toward the
  // ground and toward the ink, so nothing arrives from outside the system.
  if (sparks.length === 0) {
    sparks.push(mix(accent, ground, 0.45), mix(accent, ink, 0.45));
  } else if (sparks.length === 1) {
    sparks.push(mix(sparks[0], ground, 0.5));
  }
  return { ground, ink, accent, sparks };
}

/** A soft sphere: layered radial gradients, the shape behind most "AI" hero art. */
export function svgOrb(p: GraphicsPalette, size = 320): Snippet {
  const [a, b = p.accent, c = p.sparks[0]] = [p.sparks[0] ?? p.accent, p.sparks[1], p.sparks[2]];
  const code = `<svg width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="Gradient orb">
  <defs>
    <radialGradient id="orb-body" cx="38%" cy="32%" r="70%">
      <stop offset="0%"   stop-color="${b}" />
      <stop offset="55%"  stop-color="${a}" />
      <stop offset="100%" stop-color="${p.ink}" />
    </radialGradient>
    <radialGradient id="orb-sheen" cx="30%" cy="25%" r="35%">
      <stop offset="0%"   stop-color="${p.ground}" stop-opacity="0.85" />
      <stop offset="100%" stop-color="${p.ground}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="orb-rim" cx="70%" cy="75%" r="55%">
      <stop offset="60%"  stop-color="${c}" stop-opacity="0" />
      <stop offset="100%" stop-color="${c}" stop-opacity="0.55" />
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="46" fill="url(#orb-body)" />
  <circle cx="50" cy="50" r="46" fill="url(#orb-rim)" />
  <circle cx="50" cy="50" r="46" fill="url(#orb-sheen)" />
</svg>`;
  return {
    id: "svg-orb",
    title: "Gradient orb (SVG)",
    language: "html",
    purpose: "Hero and card artwork. Resizes without loss; change a stop-color to re-theme.",
    code,
    runnable: true,
  };
}

/**
 * An orbit diagram: hairline ellipses with a few small dots riding them.
 *
 * This is the quiet spot graphic — the shape for "there is a system at work
 * here" beside a hero or inside a media cell. Everything about it is
 * deliberately faint: the ellipses are hairlines two steps off the ground,
 * the dots are small punctuation, and at most one of them takes the accent.
 * It is the counter-example to the clip-art sparkle: geometry the interface
 * already speaks (circles, hairlines, dots), at whisper contrast, that a
 * reader's eye passes over on the way to the content.
 */
export function svgOrbit(p: GraphicsPalette, size = 320): Snippet {
  const line = mix(p.ink, p.ground, 0.78);
  const dot = p.ink;
  const accent = p.accent !== p.ink ? p.accent : mix(p.ink, p.ground, 0.35);
  const code = `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="Orbit diagram">
  <!-- Hairline orbits: stroke stays under 1 unit so it reads as a rule, not a shape. -->
  <ellipse cx="50" cy="50" rx="44" ry="18" stroke="${line}" stroke-width="0.6" transform="rotate(-24 50 50)" />
  <ellipse cx="50" cy="50" rx="34" ry="30" stroke="${line}" stroke-width="0.6" transform="rotate(38 50 50)" />
  <circle cx="50" cy="50" r="10" stroke="${line}" stroke-width="0.6" />
  <!-- Punctuation dots: small, few, mostly ink. One accent at most. -->
  <circle cx="50" cy="50" r="3.2" fill="${dot}" />
  <circle cx="13.8" cy="66.4" r="1.8" fill="${dot}" />
  <circle cx="79.6" cy="26.2" r="1.4" fill="${dot}" />
  <circle cx="63.5" cy="77.8" r="1.8" fill="${accent}" />
</svg>`;
  return {
    id: "svg-orbit",
    title: "Orbit diagram (SVG)",
    language: "html",
    purpose:
      "Spot graphic beside a hero or inside its own media cell — never behind or over text. Rotate the ellipses and move the dots; keep strokes hairline and dots under 4 units.",
    code,
    runnable: true,
  };
}

/**
 * A dot lattice that fades out — the backdrop that stays a backdrop.
 *
 * For the corner of a section or the empty half of a card. The mask is the
 * important part: the lattice dissolves before it reaches the content, so it
 * can sit at z -1 without ever competing with a word of copy.
 */
export function svgDotGrid(p: GraphicsPalette): Snippet {
  const dot = mix(p.ink, p.ground, 0.62);
  const code = `<!-- Host element needs: position:relative; isolation:isolate — without the
     isolation, z-index:-1 drops the lattice behind the host's own background
     and it silently disappears. -->
<svg width="480" height="360" viewBox="0 0 480 360" role="presentation" aria-hidden="true"
     style="position:absolute; top:0; right:0; z-index:-1; pointer-events:none">
  <defs>
    <pattern id="lattice" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.6" fill="${dot}" />
    </pattern>
    <radialGradient id="fade" cx="85%" cy="12%" r="75%">
      <stop offset="0%" stop-color="#fff" />
      <stop offset="55%" stop-color="#fff" stop-opacity="0.35" />
      <stop offset="90%" stop-color="#fff" stop-opacity="0" />
    </radialGradient>
    <mask id="dissolve"><rect width="480" height="360" fill="url(#fade)" /></mask>
  </defs>
  <rect width="480" height="360" fill="url(#lattice)" mask="url(#dissolve)" />
</svg>`;
  return {
    id: "svg-dot-grid",
    title: "Fading dot lattice (SVG)",
    language: "html",
    purpose:
      "Backdrop for a section corner or a card's empty region, behind everything at z -1 — the host must set position:relative and isolation:isolate. The mask dissolves it before it reaches the copy; move the gradient centre to move the fade.",
    code,
    runnable: true,
  };
}

/**
 * A line chart in the house discipline, distilled from the best chart an
 * agent has produced through governance (fixtures/generated/
 * signal-growth-cohere.html): three hairline gridlines and no more, an area
 * wash two steps off the ground, the line in ink because the main story is
 * the darkest thing on the chart, accent only on the data points, every
 * point focusable with its value read aloud, and a one-sentence caption
 * under the chart saying what the data shows.
 */
export function svgLineChart(p: GraphicsPalette): Snippet {
  const grid = mix(p.ink, p.ground, 0.85);
  const area = mix(p.ink, p.ground, 0.94);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const pts = [
    [50, 181, "1.2k"], [118, 166, "2.1k"], [186, 146, "3.4k"],
    [254, 117, "5.2k"], [322, 83, "7.3k"], [390, 43, "9.8k"],
  ] as const;
  const code = `<figure style="margin:0">
  <svg viewBox="0 0 420 250" role="img" aria-labelledby="lc-title lc-desc" style="display:block;width:100%;height:auto">
    <title id="lc-title">Monthly signups growth</title>
    <desc id="lc-desc">Signups rising from 1,200 in January to 9,800 in June. Illustrative data.</desc>
    <path d="M50 40H390M50 120H390M50 200H390" stroke="${grid}" stroke-width="1"/>
    <text x="10" y="44" fill="${p.ink}" font-size="12" font-family="monospace">10k</text>
    <text x="17" y="124" fill="${p.ink}" font-size="12" font-family="monospace">5k</text>
    <text x="25" y="204" fill="${p.ink}" font-size="12" font-family="monospace">0</text>
    <path d="M${pts.map(([x, y]) => `${x} ${y}`).join(" L")} L390 200 L50 200 Z" fill="${area}"/>
    <path d="M${pts.map(([x, y]) => `${x} ${y}`).join(" L")}" fill="none" stroke="${p.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
${pts.map(([x, y, v], i) => `    <circle cx="${x}" cy="${y}" r="6" fill="${p.accent}" stroke="${p.ground}" stroke-width="3" tabindex="0" aria-label="${months[i]}: ${v} signups"><title>${months[i]}: ${v}</title></circle>`).join("\n")}
${months.map((m, i) => `    <text x="${pts[i][0] - 11}" y="228" fill="${p.ink}" font-size="12" font-family="monospace">${m}</text>`).join("\n")}
  </svg>
  <figcaption style="margin-top:12px;font-size:14px;color:${p.ink}">Signups grow faster after March. Say what the data shows, in one sentence. (Illustrative data.)</figcaption>
</figure>`;
  return {
    id: "svg-line-chart",
    title: "Line chart (SVG)",
    language: "html",
    purpose:
      "One series over time. The line is the ink because the main story is the darkest thing on the chart; accent marks the points; three gridlines and no more, never a graph-paper mesh. Swap the data, keep the caption honest.",
    code,
    runnable: true,
  };
}

/**
 * A stacked bar chart walking the ladder — most important series darkest,
 * from the same golden fixture. Each stack is one focusable group with the
 * whole month read aloud.
 */
export function svgStackedBars(p: GraphicsPalette): Snippet {
  const grid = mix(p.ink, p.ground, 0.85);
  const s2 = p.sparks[0] ?? mix(p.ink, p.ground, 0.45);
  const s3 = p.sparks[1] ?? p.accent;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  // x, [h1,h2,h3] stack heights bottom-up, total label
  const bars = [
    [45, [10, 6, 3], "1.2k"], [103, [16, 10, 8], "2.1k"], [161, [26, 16, 12], "3.4k"],
    [219, [38, 26, 19], "5.2k"], [277, [53, 37, 27], "7.3k"], [335, [70, 50, 37], "9.8k"],
  ] as const;
  const stack = (x: number, hs: readonly number[]) => {
    let y = 200;
    const fills = [p.ink, s2, s3];
    return hs
      .map((h, i) => {
        y -= h;
        return `<rect x="${x}" y="${y}" width="36" height="${h}" fill="${fills[i]}"/>`;
      })
      .join("");
  };
  const code = `<figure style="margin:0">
  <svg viewBox="0 0 420 250" role="img" aria-labelledby="sb-title sb-desc" style="display:block;width:100%;height:auto">
    <title id="sb-title">Signups by source</title>
    <desc id="sb-desc">Three sources stacking to a rising total. Illustrative data.</desc>
    <path d="M45 40H390M45 120H390M45 200H390" stroke="${grid}" stroke-width="1"/>
${bars.map(([x, hs, total], i) => `    <g tabindex="0" aria-label="${months[i]} total ${total}"><title>${months[i]}: ${total}</title>${stack(x, hs)}</g>`).join("\n")}
${bars.map(([x], i) => `    <text x="${x + 4}" y="228" fill="${p.ink}" font-size="12" font-family="monospace">${months[i]}</text>`).join("\n")}
  </svg>
  <figcaption style="display:flex;gap:16px;margin-top:12px;font-size:12px;font-family:monospace;color:${p.ink}">
    <span><i style="display:inline-block;width:8px;height:8px;border-radius:8px;background:${p.ink}"></i> Primary</span>
    <span><i style="display:inline-block;width:8px;height:8px;border-radius:8px;background:${s2}"></i> Second</span>
    <span><i style="display:inline-block;width:8px;height:8px;border-radius:8px;background:${s3}"></i> Third</span>
  </figcaption>
</figure>`;
  return {
    id: "svg-stacked-bars",
    title: "Stacked bars (SVG)",
    language: "html",
    purpose:
      "Composition over time. Series walk the ladder darkest-first — the most important series is the ink, never the brightest colour. Rename the legend to the real series, swap the data, keep the units honest.",
    code,
    runnable: true,
  };
}

/** A drifting particle field on Canvas 2D — ambient background motion, no library. */
export function canvasField(p: GraphicsPalette): Snippet {
  const colours = JSON.stringify([p.accent, ...p.sparks].slice(0, 3));
  const code = `<canvas id="field" width="960" height="480" style="width:100%;height:auto;display:block;background:${p.ground}"></canvas>
<script>
(() => {
  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d");
  const COLOURS = ${colours};        // from the design system
  const COUNT = 140, SPEED = 0.35;    // density and drift — the two knobs
  const dots = Array.from({ length: COUNT }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: 1.5 + Math.random() * 2.5,
    c: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    a: Math.random() * Math.PI * 2,
  }));
  let t = 0;
  const frame = () => {
    t += 0.004;
    ctx.fillStyle = "${p.ground}";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const d of dots) {
      // A slow curl noise stand-in: each dot follows a sine field.
      d.a += Math.sin(d.x * 0.003 + t) * 0.02 + Math.cos(d.y * 0.004 - t) * 0.02;
      d.x = (d.x + Math.cos(d.a) * SPEED + canvas.width) % canvas.width;
      d.y = (d.y + Math.sin(d.a) * SPEED + canvas.height) % canvas.height;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = d.c;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  };
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) frame();
  else { ctx.fillStyle = "${p.ground}"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
})();
</script>`;
  return {
    id: "canvas-field",
    title: "Particle field (Canvas 2D)",
    language: "html",
    purpose: "Ambient section background. COUNT and SPEED are the parameters; colours come from the palette.",
    code,
    runnable: true,
  };
}

/** WGSL for an animated mesh gradient: four colour points blended by distance. */
export function wgslMeshGradient(p: GraphicsPalette): string {
  const [c1, c2, c3] = [p.accent, p.sparks[0] ?? p.accent, p.sparks[1] ?? p.ink];
  return `struct Uniforms { time: f32, aspect: f32 };
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VSOut {
  // One triangle that covers the clip space; uv derived from it.
  let p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: VSOut;
  o.pos = vec4f(p[i], 0.0, 1.0);
  o.uv = (p[i] + 1.0) * 0.5;
  return o;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let uv = vec2f(in.uv.x * u.aspect, in.uv.y);
  let t = u.time * 0.15;
  // Four colour points drifting on Lissajous paths — the "mesh".
  let p0 = vec2f(0.30 + 0.20 * sin(t * 1.1), 0.35 + 0.18 * cos(t * 0.9));
  let p1 = vec2f(0.70 * u.aspect + 0.18 * cos(t * 0.7), 0.30 + 0.20 * sin(t * 1.3));
  let p2 = vec2f(0.45 * u.aspect + 0.22 * sin(t * 0.8), 0.75 + 0.15 * cos(t * 1.2));
  let p3 = vec2f(0.15 + 0.12 * cos(t), 0.85 + 0.10 * sin(t * 0.6));
  let c0 = vec3f(${vec3(c1)});   // accent
  let c1 = vec3f(${vec3(c2)});   // spark
  let c2 = vec3f(${vec3(c3)});   // spark or ink
  let c3 = vec3f(${vec3(p.ground)}); // ground
  // Inverse-distance weights: smooth, no seams, cheap.
  let w0 = 1.0 / (0.02 + dot(uv - p0, uv - p0));
  let w1 = 1.0 / (0.02 + dot(uv - p1, uv - p1));
  let w2 = 1.0 / (0.02 + dot(uv - p2, uv - p2));
  let w3 = 1.0 / (0.02 + dot(uv - p3, uv - p3));
  let col = (c0 * w0 + c1 * w1 + c2 * w2 + c3 * w3) / (w0 + w1 + w2 + w3);
  // Fine grain so large flat areas do not band.
  let grain = (fract(sin(dot(in.uv * 1000.0, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.02;
  return vec4f(col + grain, 1.0);
}`;
}

/** GLSL ES 3.00 twin of the WGSL, for the WebGL2 fallback. */
export function glslMeshGradient(p: GraphicsPalette): string {
  const [c1, c2, c3] = [p.accent, p.sparks[0] ?? p.accent, p.sparks[1] ?? p.ink];
  return `#version 300 es
precision highp float;
uniform float u_time; uniform float u_aspect;
in vec2 v_uv; out vec4 outColor;
void main() {
  vec2 uv = vec2(v_uv.x * u_aspect, v_uv.y);
  float t = u_time * 0.15;
  vec2 p0 = vec2(0.30 + 0.20 * sin(t * 1.1), 0.35 + 0.18 * cos(t * 0.9));
  vec2 p1 = vec2(0.70 * u_aspect + 0.18 * cos(t * 0.7), 0.30 + 0.20 * sin(t * 1.3));
  vec2 p2 = vec2(0.45 * u_aspect + 0.22 * sin(t * 0.8), 0.75 + 0.15 * cos(t * 1.2));
  vec2 p3 = vec2(0.15 + 0.12 * cos(t), 0.85 + 0.10 * sin(t * 0.6));
  vec3 c0 = vec3(${vec3(c1)});
  vec3 c1 = vec3(${vec3(c2)});
  vec3 c2 = vec3(${vec3(c3)});
  vec3 c3 = vec3(${vec3(p.ground)});
  float w0 = 1.0 / (0.02 + dot(uv - p0, uv - p0));
  float w1 = 1.0 / (0.02 + dot(uv - p1, uv - p1));
  float w2 = 1.0 / (0.02 + dot(uv - p2, uv - p2));
  float w3 = 1.0 / (0.02 + dot(uv - p3, uv - p3));
  vec3 col = (c0 * w0 + c1 * w1 + c2 * w2 + c3 * w3) / (w0 + w1 + w2 + w3);
  float grain = (fract(sin(dot(v_uv * 1000.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.02;
  outColor = vec4(col + grain, 1.0);
}`;
}

/**
 * A complete page snippet: WebGPU first, WebGL2 when it is not there.
 *
 * WebGPU is the current API and the one an agent should reach for; it is not
 * on every browser yet, so the same gradient is written twice — WGSL and
 * GLSL — and the page picks whichever it can run. Both shaders are the
 * generated strings above, so what an agent copies is what rendered.
 */
export function shaderGradient(p: GraphicsPalette): Snippet {
  const code = `<canvas id="mesh" style="width:100%;height:360px;display:block;background:${p.ground}"></canvas>
<script type="module">
const canvas = document.getElementById("mesh");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fit = () => { const r = devicePixelRatio || 1; canvas.width = canvas.clientWidth * r; canvas.height = canvas.clientHeight * r; };
fit(); addEventListener("resize", fit);

const WGSL = \`${wgslMeshGradient(p).replace(/`/g, "\\`")}\`;
const GLSL_FS = \`${glslMeshGradient(p).replace(/`/g, "\\`")}\`;
const GLSL_VS = \`#version 300 es
in vec2 a_pos; out vec2 v_uv;
void main() { v_uv = (a_pos + 1.0) * 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }\`;

async function webgpu() {
  if (!navigator.gpu) return false;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  const device = await adapter.requestDevice();
  const ctx = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "opaque" });
  const module = device.createShaderModule({ code: WGSL });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: { module, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const uniform = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniform } }] });
  const start = performance.now();
  const frame = () => {
    const t = reduced ? 0 : (performance.now() - start) / 1000;
    device.queue.writeBuffer(uniform, 0, new Float32Array([t, canvas.width / canvas.height, 0, 0]));
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
    pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.draw(3); pass.end();
    device.queue.submit([enc.finish()]);
    if (!reduced) requestAnimationFrame(frame);
  };
  frame();
  return true;
}

function webgl2() {
  const gl = canvas.getContext("webgl2");
  if (!gl) return false;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, GLSL_VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, GLSL_FS)); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uT = gl.getUniformLocation(prog, "u_time"), uA = gl.getUniformLocation(prog, "u_aspect");
  const start = performance.now();
  const frame = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uT, reduced ? 0 : (performance.now() - start) / 1000);
    gl.uniform1f(uA, canvas.width / canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced) requestAnimationFrame(frame);
  };
  frame();
  return true;
}

if (!(await webgpu())) webgl2();
</script>`;
  return {
    id: "shader-gradient",
    title: "Mesh gradient (WebGPU, WebGL2 fallback)",
    language: "html",
    purpose: "Full-bleed hero or CTA band. Four colour points drift; change the vec3 literals to re-theme.",
    code,
    runnable: true,
  };
}

/**
 * The same graphic as a shadcn-style component over a maintained shader
 * library.
 *
 * Hand-written shaders are the right teaching material and the right
 * fallback; a project that already uses React should reach for a library
 * that ships thirty tuned shaders and keeps them working across GPUs. Paper
 * Shaders takes colours as strings, so the palette drops straight in and
 * nothing about the graphic is a file. The component follows shadcn's
 * conventions — a `cn()` class merge, props spread to the root — so it sits
 * beside the rest of a shadcn/ui project without ceremony.
 */
export function paperMesh(p: GraphicsPalette): Snippet {
  const colours = JSON.stringify([p.ground, p.accent, ...p.sparks].slice(0, 5));
  const code = `// components/ui/mesh-background.tsx
// Install: npm i @paper-design/shaders-react
"use client";

import { MeshGradient, type MeshGradientProps } from "@paper-design/shaders-react";
import { cn } from "@/lib/utils";

/** Design-system colours; edit here, never inline. */
export const MESH_COLORS = ${colours};

type MeshBackgroundProps = Omit<MeshGradientProps, "colors"> & {
  /** Override only when a section needs a different mood; defaults to the system palette. */
  colors?: string[];
};

/**
 * A full-bleed animated mesh gradient for hero and CTA bands.
 * Distortion and swirl are the two knobs that change its character;
 * keep speed low so type stays readable over it.
 */
export function MeshBackground({ className, colors = MESH_COLORS, ...props }: MeshBackgroundProps) {
  return (
    <MeshGradient
      className={cn("absolute inset-0 -z-10 h-full w-full", className)}
      colors={colors}
      distortion={0.8}
      swirl={0.35}
      grainMixer={0.15}
      grainOverlay={0.05}
      speed={0.25}
      {...props}
    />
  );
}

// Usage — a hero band:
// <section className="relative isolate min-h-[60vh]">
//   <MeshBackground />
//   <h1 className="relative z-10 …">Ready to put it to work?</h1>
// </section>`;
  return {
    id: "paper-mesh",
    title: "Mesh gradient (React · @paper-design/shaders-react)",
    language: "tsx",
    purpose: "The same band as a shadcn-style component over a maintained shader library. Use this in a React project; the hand-written shader is the fallback and the reference.",
    code,
    runnable: false,
    install: "npm i @paper-design/shaders-react",
  };
}

export function graphicsKit(system: DesignSystem): { palette: GraphicsPalette; snippets: Snippet[] } {
  const palette = paletteForGraphics(system);
  return {
    palette,
    snippets: [
      svgOrbit(palette),
      svgDotGrid(palette),
      svgOrb(palette),
      svgLineChart(palette),
      svgStackedBars(palette),
      canvasField(palette),
      shaderGradient(palette),
      paperMesh(palette),
    ],
  };
}
