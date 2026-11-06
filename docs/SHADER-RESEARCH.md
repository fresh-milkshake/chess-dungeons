# Material shaders — local laboratory

Current visual revision: D1–D4 keep their original shaders; D5 keeps the caustic
replacement; all five ether variants have been redesigned for a new selection.
Empowerment uses the
softer reflection variants described in Revision 4 below. Older revision notes
record earlier experiments and their checks.

The approved shaders are also connected to `materials.html`. Each of the five
non-king types for both colours uses D3 / E4 / P5 in its material/effect row.
Ordinary references, stone, glass, ruins and kings remain plain PNGs. An added
empowerment section previews the independent attack effect on ordinary Neo.
This page uses one shared WebGL2 context with 30 active sprite textures resized
to at most 512 pixels for these small previews. Only sprites inside the viewport
are drawn; scroll also invalidates a paused frame. Source assets stay unchanged.
The laboratory retains its original full-resolution texture path.

Approved selection: **D3 Star dust at 100%, E4 Between worlds at 100%,
P5 Ember mist at 175%**. E4 is selected in the laboratory and used on the
materials page for both colours and all five non-king piece types.
Preset data lives in `variants.js`; the global strength slider multiplies each
candidate's baseline. Laboratory storage is `chess-dungeons-shader-lab-v4`.
Migration preserves diamond/power choices from v3 (or v2) and initializes ether
to the newly approved E4. Further choices persist across reloads.

Each laboratory card now displays white and black sprites side by side, using
the same shader phase and intensity. The piece selector changes both sides;
the separate colour selector is removed. Eighteen cards render 36 sprites with
six shared textures in one WebGL2 context. Desktop uses three cards per row,
tablet two, mobile one, so both sides remain large enough to compare.

New ether collection: Moon opal, Smoky veil, Ghost silk, Between worlds, Star
ether. Its colour fields and local highlights/refraction were all replaced;
diamond and power shader branches are unchanged. Real GPU readbacks verified
all five new ether effects animate on both colours, intensity zero matches the
original, and corner alpha remains zero. The paired gallery draws 36 sprites
without WebGL errors. A 390 px viewport has no horizontal overflow.

## Technology decision (20 October 2026)

The project renders transparent Neo PNG sprites (300×300 originals and larger
generated material variants), not 3D meshes. We need
animated colour, masked highlights, procedural wisps and a small silhouette glow.
We do not have surface normals or geometry, so these are art-directed 2D effects,
not a physically accurate simulation of diamond refraction.

| Option | Fit for this project |
| --- | --- |
| CSS filters / animated overlays | Good for a tint, poor control over animated facets, noise and alpha-masked light. |
| Canvas 2D pixel processing | Possible, but per-pixel procedural animation belongs on the GPU rather than a JavaScript loop. |
| WebGL2 / GLSL ES 3 | Selected: established browser support, direct texture sampling, one small renderer and no added dependencies. |
| WebGPU / WGSL, including vgpu | Useful modern GPU tooling, but additional integration and narrower browser availability do not buy us anything necessary for these small sprite effects. Reconsider for a larger scene renderer or compute effects. |

Sources reviewed:

- [WebGL2RenderingContext — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext): OpenGL ES 3 canvas interface and browser support.
- [WebGPU API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API): modern GPU rendering / compute API, secure contexts and limited availability.
- [Canvas getContext — MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext): context and alpha configuration.
- [vgpu official repository](https://github.com/vercel-labs/vgpu): modular WebGPU library, WGSL effects, surface sizing and frame loops. The root vgpu.sh page could not be retrieved by the research tool; the official repository and its linked example were accessible.
- [vgpu gradient example](https://vgpu.sh/examples/gradient): a fullscreen WGSL effect workflow.

## Implementation

`src/lab/shaders/` contains the catalog, GLSL source, shared renderer, and laboratory
controls. A single transparent WebGL2 canvas draws 18 sprites: 15 effects and three
unchanged references. There are no separate WebGL contexts per card. The renderer
uses original texture alpha, premultiplied output, linear filtering with mipmaps,
and a backing resolution up to 2× CSS pixels (clamped to GPU viewport limits).
The texture cache retains at most two sets (six textures), rather than every
large generated image viewed in the session.

Animation runs at up to 30 FPS, pauses outside the visible gallery or hidden tab,
and defaults to paused with reduced-motion settings. GPU context loss shows the
PNG fallback; restoration rebuilds the program and textures. Missing WebGL2 or
textures also leaves the source images visible with an explanatory status.

The laboratory has five diamond variants D1–D5, five ethereal variants E1–E5, and
five red empowerment variants P1–P5. Each category uses its own existing Neo PNG:
diamond, ethereal, or ordinary for empowerment. Controls switch all five non-king
piece types, both sides, background, intensity, speed, pause and source comparison.
Kings are deliberately excluded. Favourite IDs persist locally under
`chess-dungeons-shader-lab-v1`; selecting one does not change gameplay rendering.

Use the Effects / Mechanics tabs on `lab.html` to switch between this gallery and
the existing Fairy-Stockfish rules laboratory.

## Verification

Actual Chromium WebGL2 execution, not just shader string checks:

- Program compiled and linked; 18 sprite draws, zero WebGL errors.
- All five piece types for both colours loaded and rendered (ten selections).
- Pixel readbacks changed for every one of the 15 effects at nonzero intensity;
  the three references stayed identical and sprite corner alpha stayed zero.
- Pixel readbacks at two animation phases changed for all 15 variants while the
  three references remained identical. Pause froze the animation phase.
- Deliberate context loss displayed the PNG fallback; restoration recompiled and
  reloaded successfully. A separate browser context with WebGL2 disabled also
  displayed all source images and an explanatory status.
- Reduced-motion emulation froze the phase and updated the pause button.
- 390 px mobile viewport used three columns with no horizontal overflow.
- Local favourite IDs survived reload; the mechanics tab still rendered 64
  squares and loaded its engine position.
- `npm test`: 30 passed. `npm run build`: passed.

Screenshot: `.qa/shader-lab.png` (local, ignored).

## Revision 2: moving events, no persistent tint

**Current scope correction:** at the player's request, D1–D4 have been restored
to the original diamond shaders and original labels. Only D5 (formerly “Icy
heart”, now “Light caustic”) keeps its revision 2 replacement. E1–E5 and P1–P5
keep revision 2. The no-persistent-tint rule below therefore applies to D5,
ethereal and empowerment; D1–D4 are intentionally preserved for comparison.

All fifteen variants were redesigned after visual review. There is no permanent
whole-sprite colour overlay, alpha reduction or glowing outline. Each effect has
a spatial event mask: a passing light front, a travelling cloud, a moving local
refraction, short curved particle trails, or expanding energy rings. Outside the
event the source pixels remain unchanged. Empowerment uses red only where the
moving event is present. Ethereal dissolution and refraction are local too.

E5 “Astral threads” was replaced with drifting wisps with tapered curved wakes;
the old repeated full-width sine stripes have been removed. The renderer now
allows up to 0.5 s of elapsed time per frame so lower frame rates do not slow the
effects as severely as the previous 0.1 s cap.

GPU pixel readbacks at 16 phases across 8.55 seconds verified all 15 variants
animate and that no source pixel stays modified at every sampled phase (0% in
each variant, tolerance 3/255). This is a sampled regression check of the moving
masks, not a claim about visual taste or every possible frame. The new program
compiles and draws all 18 cards with zero WebGL errors. Build and 30 tests pass.

## Revision 4: restrained empowerment reflections

The empowerment family was rebuilt around transparent surface reflections rather
than the previous dense pigment layer. The ordinary PNG alpha is unchanged:
“transparent” describes the effect's mixing weight, not making the chess piece
itself translucent. Diamond and ethereal shader branches are unchanged.

Five options: scarlet pearl, ruby dust, silk sheen, scarlet facets and ember mist.
At default intensity the colour contribution is usually about 0–25%, with sparse
sparkle peaks around 31%; the earlier broad 50–70% pigment layer and opaque local
red stripes are removed. All colour masks remain animated. The intensity slider
can still deliberately exaggerate the effect.

References reviewed for this revision:

- [Holographic Card](https://vgpu.sh/examples/holographic-card) and its
  [complete WGSL source](https://vgpu.sh/examples/holographic-card/source.md):
  inspected the live preview with pointer reveal and the source's layered pearl
  wash, narrower glint, micro-sparkles and diffraction. The new red effects use
  that separation of broad soft reflection and restrained detail, with original
  GLSL formulas adapted to a sprite. This is artistic inspiration, not a port of
  its physical diffraction model.
- [Matcap Shading](https://vgpu.sh/examples/matcap): read the lighting-lookup
  approach; a 3D normal-based matcap is unnecessary for our existing flat PNGs.
- [Glass Sculpture](https://vgpu.sh/examples/glass-sculpture) and source:
  reviewed Fresnel-weighted reflection and selective bloom extraction. Retained
  the idea of limited highlights, without adding a 3D glass renderer or bloom
  pipeline to the small gallery.
- [GPU Gems, Simulating Diffraction](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-8-simulating-diffraction):
  additional primary background on coloured diffraction and the separate
  anisotropic highlight; our red empowerment is intentionally art-directed.

Revision 4 verification: real WebGL2 program linked and rendered the gallery
without errors. All five power options animated on white and black knights over
eight sampled phases. Opaque source alpha stayed opaque; intensity zero matched
the reference exactly. Peak mean RGB-channel changes over the solid sprite were
about 1–15/255 across these samples, consistent with a restrained overlay. These
are diagnostic samples, not a perceptual quality score. `npm run build` passed.
