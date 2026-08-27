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
  id: "svg-orb" | "canvas-field" | "shader-gradient" | "paper-mesh";
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
  return { palette, snippets: [svgOrb(palette), canvasField(palette), shaderGradient(palette), paperMesh(palette)] };
}
