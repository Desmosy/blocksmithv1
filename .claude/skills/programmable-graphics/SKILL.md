---
description: Create polished, programmable graphics and animations from
  visual references, hand-drawn/Figma geometry, screenshots, and SVGs.
  Use for data visualizations, particle systems, wireframes, geometric
  illustrations, brand graphics, and interactive web animations.
name: programmable-graphics
---

# Programmable Graphics

Build graphics as **designed systems**, not one-off illustrations. The
goal is to turn a visual reference or sketch into clean, controllable
code that can be refined through short iterations and embedded into a
real website.

## Core principle

Treat every graphic as four layers:

1.  **Geometry** --- the exact shapes, paths, planes, points, and
    relationships.
2.  **Rendering** --- how geometry becomes pixels: SVG, Canvas,
    WebGL/Three.js, particles, lines, shaders, etc.
3.  **Motion** --- how one visual state transforms into another.
4.  **Integration** --- how the graphic exposes parameters and interacts
    with surrounding HTML/UI.

Do not jump directly into animation. First reproduce the geometry and
visual language, then add motion.

------------------------------------------------------------------------

# Workflow

## 1. Understand the visual reference

When given a screenshot, image, Figma sketch, or website reference:

-   Identify the visual primitives.
-   Determine whether the graphic is 2D, pseudo-3D, or genuinely 3D.
-   Separate static geometry from animated elements.
-   Identify the coordinate system and perspective.
-   Estimate density, scale, stroke weight, opacity, spacing, and color.
-   Look for repeated structures that should become parameters.
-   Identify which parts need to remain exact and which can be
    procedural.

For a reference like a technical/architectural particle illustration,
break it into components such as:

-   perspective planes
-   grid lines
-   circular markers
-   connection lines
-   point clouds
-   particles
-   labels or controls
-   transition states

Prefer a small number of reusable primitives over manually drawing
hundreds of unrelated elements.

### Reference analysis checklist

Before writing code, answer:

-   What is the dominant composition?
-   What are the primary primitives?
-   What is the background?
-   What is the stroke/particle language?
-   Is perspective orthographic, perspective, or simulated?
-   Which elements are fixed?
-   Which elements move?
-   Which elements need exact geometry?
-   Which parameters should be exposed?
-   What is the final target environment?

If the reference is ambiguous, make the smallest reasonable assumption
and keep it easy to change.

------------------------------------------------------------------------

# 2. Recreate geometry from Figma or SVG

If the user provides an SVG, treat it as a **geometry source**, not
merely an image.

Inspect:

-   `path`
-   `polyline`
-   `polygon`
-   `line`
-   `circle`
-   `rect`
-   `viewBox`
-   transforms
-   stroke width
-   fill
-   opacity

Preserve the original coordinate relationships whenever possible.

## Important

Do not redraw an SVG approximately when its paths can be reused.

A good pipeline is:

``` text
Figma sketch
    ↓
SVG export
    ↓
parse paths / points
    ↓
normalize coordinates
    ↓
map to rendering coordinates
    ↓
animate / sample / morph
```

If a complex SVG needs to become particles:

1.  Parse its paths.
2.  Sample points along each path.
3.  Normalize those points.
4.  Preserve the original aspect ratio.
5.  Map them into the animation's coordinate system.
6.  Use those points as a target state for particles.

For line-based illustrations, keep the original vector paths for crisp
rendering whenever possible and use particles only where they add visual
value.

------------------------------------------------------------------------

# 3. Choose the rendering technology

Use the simplest technology that can produce the desired result.

### SVG

Prefer SVG when:

-   geometry must stay crisp
-   the graphic is mostly lines and paths
-   there are relatively few elements
-   exact Figma geometry matters
-   accessibility or DOM interaction matters

### Canvas

Prefer Canvas when:

-   there are thousands of particles
-   many points update every frame
-   the visual is fundamentally particle-based
-   DOM/SVG would become expensive

### WebGL / Three.js

Prefer WebGL or Three.js when:

-   genuine 3D is required
-   there are thousands of animated points
-   depth, camera movement, or 3D transforms matter
-   GPU rendering is beneficial

Do not introduce Three.js merely because the reference looks technical.
A carefully designed Canvas/SVG implementation may be better.

------------------------------------------------------------------------

# 4. Build the static state first

Before adding animation, make one frame look correct.

The first implementation should establish:

-   canvas/SVG dimensions
-   background
-   coordinate system
-   camera/projection
-   geometry
-   line weights
-   point size
-   opacity
-   spacing
-   composition

Do not add random motion yet.

A useful structure is:

``` text
initialize()
  ├── create renderer
  ├── create scene
  ├── define geometry
  ├── define visual parameters
  └── render static state

animate()
  ├── update state
  ├── interpolate geometry
  ├── render
  └── request next frame
```

This makes visual debugging dramatically easier.

------------------------------------------------------------------------

# 5. Separate geometry from rendering

Keep the data describing the graphic independent from the code that
renders it.

Example conceptual model:

``` js
const graphic = {
  points: [...],
  lines: [...],
  planes: [...],
  states: {
    initial: [...],
    target: [...]
  }
};
```

Then expose visual parameters separately:

``` js
const params = {
  particleCount: 2500,
  pointSize: 1.2,
  lineOpacity: 0.45,
  transitionDuration: 1200,
  rotationSpeed: 0.002,
  parallax: 0.15
};
```

This lets the same graphic be art-directed without rewriting its
geometry.

------------------------------------------------------------------------

# 6. Particle systems

When a graphic uses particles, avoid making every particle behave
independently unless randomness is part of the design.

A strong particle architecture uses:

``` text
particle
  ├── current position
  ├── target position
  ├── velocity
  ├── size
  ├── opacity
  └── optional randomness/phase
```

For a morphing graphic:

``` text
currentPosition
       ↓
interpolate
       ↓
targetPosition
```

Use easing rather than abrupt switching.

For example:

``` js
t = easeInOutCubic(progress);
x = lerp(start.x, target.x, t);
y = lerp(start.y, target.y, t);
z = lerp(start.z, target.z, t);
```

If particle counts differ between states, resample or intelligently
distribute points instead of creating obvious popping.

------------------------------------------------------------------------

# 7. Morphing between illustrations

Represent every visual illustration as a **state**.

Example:

``` js
const states = {
  grid: [...],
  cluster: [...],
  sphere: [...],
  logo: [...]
};
```

A transition should be:

``` text
STATE A
   ↓
softening / dispersion
   ↓
bloop / intermediate state
   ↓
reformation
   ↓
STATE B
```

Avoid:

``` text
STATE A → STATE B
```

when the direct interpolation creates a stiff or mechanical result.

The intermediate state can use:

-   temporary expansion
-   noise
-   radial displacement
-   easing
-   spring-like motion
-   opacity changes
-   slight overshoot

The visual should feel continuous rather than like one SVG was simply
replaced by another.

------------------------------------------------------------------------

# 8. The "bloop" transition

For fluid particle transitions, use a three-stage mental model:

``` text
static → dissolve / expand → reform → static
```

A practical implementation can combine:

-   position interpolation
-   radial expansion
-   noise displacement
-   opacity modulation
-   staggered timing
-   easing

Conceptually:

``` js
const morph = easeInOut(progress);

const x = lerp(start.x, target.x, morph);
const y = lerp(start.y, target.y, morph);

const displacement = Math.sin(progress * Math.PI) * strength;

x += noiseX * displacement;
y += noiseY * displacement;
```

The displacement should peak during the middle of the transition and
return to zero at the end.

Do not leave particles permanently noisy. Noise should serve the
transition.

------------------------------------------------------------------------

# 9. Perspective and 3D-looking graphics

For technical diagrams and wireframe graphics, decide whether you
actually need a 3D engine.

A 3D-looking result can often be produced from projected points.

For an orthographic-style projection:

``` text
screenX = x + z * depthX
screenY = y + z * depthY
```

For perspective projection:

``` text
screenX = focalLength * x / (z + cameraZ)
screenY = focalLength * y / (z + cameraZ)
```

Keep the projection function separate:

``` js
function project(point, camera) {
  // return screen-space coordinates
}
```

This makes camera behavior easy to refine.

For a graphic resembling an architectural/scientific diagram:

-   use very thin strokes
-   keep perspective consistent
-   avoid excessive 3D shading
-   use a restrained palette
-   let empty space dominate
-   make particle clusters feel intentional
-   keep intersections clean

------------------------------------------------------------------------

# 10. Visual hierarchy

A programmable graphic should not become visually noisy just because
code makes it easy to add elements.

Prioritize:

1.  silhouette
2.  major geometry
3.  focal cluster
4.  secondary structure
5.  particles/details

Use opacity and scale to create hierarchy.

For example:

``` text
background
  ↓
very subtle construction lines
  ↓
primary geometry
  ↓
focal particles
  ↓
small markers
```

Do not give every element the same visual weight.

------------------------------------------------------------------------

# 11. Iteration loop

Use a tight loop:

``` text
implement
   ↓
render screenshot
   ↓
compare with reference
   ↓
identify 1–3 largest mismatches
   ↓
make targeted change
   ↓
render again
```

Do not change ten unrelated things at once.

When reviewing a screenshot, check in this order:

### A. Composition

-   Is the graphic positioned correctly?
-   Is the scale correct?
-   Is the negative space correct?

### B. Geometry

-   Are lines/planes aligned?
-   Are intersections correct?
-   Are proportions correct?

### C. Visual language

-   Stroke weight
-   point size
-   opacity
-   contrast
-   background
-   density

### D. Motion

-   Is the timing natural?
-   Does the transition pause?
-   Does anything snap?
-   Does the intermediate state feel intentional?

------------------------------------------------------------------------

# 12. Screenshot-driven debugging

When the user supplies a screenshot and says something feels wrong, do
not rewrite the whole implementation.

Translate visual feedback into a concrete engineering hypothesis.

Examples:

**"There are gaps."**

Possible causes:

-   insufficient point sampling
-   particles assigned unevenly
-   path discontinuities
-   incorrect normalization

**"Lines spill outside the boundary."**

Possible causes:

-   incorrect clipping
-   coordinate transform mismatch
-   wrong projection
-   path endpoints not normalized

**"The transition feels jerky."**

Possible causes:

-   linear interpolation
-   abrupt state changes
-   mismatched particle counts
-   an intermediate state that is too static
-   easing applied to the wrong property

**"The graphic feels too heavy."**

Try:

-   lower opacity
-   thinner strokes
-   fewer particles
-   more whitespace
-   smaller point size

Always identify the likely cause before changing the implementation.

------------------------------------------------------------------------

# 13. Make every important parameter controllable

Expose art-direction parameters rather than burying magic numbers
throughout the code.

Useful parameters include:

``` js
{
  particleCount,
  particleSize,
  particleOpacity,
  lineOpacity,
  lineWidth,
  gridSpacing,
  cameraX,
  cameraY,
  cameraZ,
  rotationX,
  rotationY,
  rotationSpeed,
  transitionDuration,
  transitionEase,
  noiseStrength,
  noiseScale,
  parallaxStrength
}
```

Group parameters logically:

``` js
const style = {};
const geometry = {};
const motion = {};
const camera = {};
```

This turns the graphic into a reusable design system rather than a
single animation.

------------------------------------------------------------------------

# 14. Interaction and website integration

Keep the graphic separate from surrounding text and UI whenever
possible.

Recommended architecture:

``` text
HTML / React / Webflow
        │
        ├── text / controls / navigation
        │
        └── graphic container
                │
                └── animation runtime
```

Expose a small API:

``` js
graphic.setState("cluster");
graphic.setProgress(0.5);
graphic.setParameter("particleCount", 4000);
graphic.destroy();
```

For DOM-driven interactions, use data attributes where appropriate:

``` html
<div data-graphic-state="cluster"></div>
```

This lets designers position and style text independently from the
animation.

------------------------------------------------------------------------

# 15. Responsive behavior

Never assume the desktop canvas dimensions are fixed.

Support:

-   resize
-   device pixel ratio
-   mobile aspect ratios
-   reduced motion
-   touch/pointer interaction

A good resize flow is:

``` js
resizeObserver
  ↓
update dimensions
  ↓
update pixel ratio
  ↓
recalculate projection
  ↓
preserve graphic proportions
```

Avoid stretching geometry non-uniformly.

If the graphic must preserve its composition, scale it uniformly and
reposition it instead of independently scaling X and Y.

------------------------------------------------------------------------

# 16. Performance

For large particle systems:

-   use typed arrays where appropriate
-   avoid creating objects inside the animation loop
-   avoid unnecessary DOM updates
-   batch rendering
-   use GPU rendering for genuinely large systems
-   cap device pixel ratio when necessary
-   pause animation when off-screen
-   use `requestAnimationFrame`

For Canvas:

``` js
const dpr = Math.min(window.devicePixelRatio, 2);
```

For thousands of particles, avoid:

``` js
particles.forEach(p => {
  // allocate new vectors / objects every frame
});
```

Prefer reusable buffers and predictable memory usage.

Performance should not come at the expense of the visual reference, but
do not use WebGL complexity without a measurable reason.

------------------------------------------------------------------------

# 17. Framework integration

Keep the animation engine framework-agnostic when possible.

For React:

``` text
React component
  ↓
mount canvas
  ↓
initialize animation
  ↓
subscribe to state
  ↓
cleanup on unmount
```

For Vue, use the same separation.

For Webflow:

-   keep markup/embed code minimal
-   place runtime JavaScript in the appropriate global location
-   use data attributes for state
-   avoid coupling the graphic's typography to Webflow text styles

The animation should behave like a component, not like a page-wide
script.

------------------------------------------------------------------------

# 18. Prompting and iteration

When working with an AI coding agent, give one clear change at a time.

Good:

> Make the vertical planes 20% wider, keep the particle cluster
> unchanged, and do not modify the camera.

Better than:

> Make it more like the reference.

Use constraints:

``` text
Change:
- line opacity

Keep:
- geometry
- camera
- particle positions

Do not:
- add new elements
- change the background
```

For larger changes, ask the coding agent to explain:

1.  which file it will change
2.  which function controls the behavior
3.  what parameter it will expose
4.  how the change affects existing states

------------------------------------------------------------------------

# 19. Working from a hand-drawn sketch

A sketch does not need to be aesthetically perfect.

Its purpose is to communicate:

-   geometry
-   relative placement
-   number of objects
-   connections
-   composition
-   motion direction

Use the sketch as the source of truth for structure.

Then let code control:

-   exact spacing
-   smoothing
-   particle density
-   stroke weight
-   color
-   animation
-   responsiveness

The sketch defines **what exists**. The code defines **how it behaves**.

------------------------------------------------------------------------

# 20. Working from an SVG

When an SVG is supplied:

1.  Inspect the `viewBox`.
2.  Identify all drawable primitives.
3.  Determine which paths are structural and which are decorative.
4.  Preserve the coordinate system.
5.  Normalize only when necessary.
6.  Sample paths only when particles are required.
7.  Keep original vectors for crisp line rendering.
8.  Verify that transforms have been resolved correctly.
9.  Compare the rendered geometry against the source SVG.

If the SVG contains many paths, build a reusable parser rather than
manually copying coordinates.

------------------------------------------------------------------------

# 21. Avoid common failure modes

### Failure: "AI art" instead of designed geometry

Symptom: - random particles - arbitrary curves - inconsistent
perspective

Fix: - derive geometry from explicit coordinates or SVG paths - use
deterministic procedural generation

### Failure: too much randomness

Symptom: - every render looks different - reference cannot be matched

Fix: - use seeded randomness - reserve randomness for controlled
variation

### Failure: direct state swapping

Symptom: - animation pops or snaps

Fix: - interpolate states - add a deliberate intermediate transition

### Failure: geometry and rendering are coupled

Symptom: - changing one thing breaks everything

Fix: - separate geometry, projection, rendering, and motion

### Failure: hard-coded responsive dimensions

Symptom: - desktop looks good, mobile breaks

Fix: - use normalized coordinates and a projection/layout layer

### Failure: endless micro-tweaks

Symptom: - dozens of small changes with no improvement

Fix: - identify the top three visual mismatches and fix those first

------------------------------------------------------------------------

# 22. Quality bar

Before considering a programmable graphic complete, verify:

-   [ ] The composition matches the reference.
-   [ ] The major geometry is correct.
-   [ ] The coordinate system is consistent.
-   [ ] Stroke and particle weights feel intentional.
-   [ ] There is clear visual hierarchy.
-   [ ] Animation has a deliberate beginning, middle, and end.
-   [ ] Transitions do not snap or stall.
-   [ ] Particle density is controlled.
-   [ ] Responsive behavior is acceptable.
-   [ ] Important parameters are easy to tune.
-   [ ] The animation can be embedded without owning surrounding
    typography/layout.
-   [ ] The implementation avoids unnecessary dependencies.
-   [ ] Performance is acceptable at the target particle count.
-   [ ] Reduced-motion behavior is considered.
-   [ ] The final result has been compared against the reference at the
    same scale.

------------------------------------------------------------------------

# Default implementation strategy

Unless the reference clearly demands something else, use this sequence:

``` text
Reference
   ↓
visual decomposition
   ↓
Figma/SVG geometry when available
   ↓
normalized coordinate model
   ↓
static rendering
   ↓
parameterized visual system
   ↓
particle/path sampling if needed
   ↓
state-based animation
   ↓
smooth morph/bloop transition
   ↓
interaction
   ↓
responsive integration
   ↓
screenshot comparison
   ↓
targeted refinement
```

The final implementation should feel less like "an animation generated
by AI" and more like **a small, controllable graphics engine designed
around a specific visual language**.
