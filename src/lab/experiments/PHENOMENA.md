# New-world material experiments

The 25 A–E studies are live materials for the five proposed worlds. They can be
previewed on the full experimental chessboard. They do not replace campaign
biomes or the approved piece-material presets. Current-act studies are a separate
gallery with four material pairs for each individual campaign biome (24 pairs).

## Research and interpretation

- NVIDIA, [Rendering Water Caustics](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics): wave slopes, concentration of refracted light, procedural approximations.
- NVIDIA, [Generic Refraction Simulation](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-19-generic-refraction-simulation): perturbed sampling coordinates and reflection/refraction mixing.
- Google, [Physically Based Rendering in Filament](https://google.github.io/filament/Filament.md.html): material response, clear coatings and directional reflections.

`phenomena-source.js` is original GLSL using those general ideas. These are
bounded artistic approximations, not a fluid solver, gravity simulation, photon
tracer or calibrated spectral renderer. The thin-film effect uses wavelength-
dependent optical phase; the internal volumes accumulate extinction and light
through six samples. The overhead camera and piece geometry stay unchanged.

## Families

| World | Five optical behaviors |
| --- | --- |
| Cosmic | Absorbing internal gas, internal lens distortion, opposing time directions, flowing micro-normal reflection, layered illuminated dust |
| Aquatic | Wave-driven caustics, ink-like advection, thin-film pearl interference, freezing domains, counterflow |
| Spectral | Layered extinction, small spectral separation, negative light response, refractive shimmer, condensation |
| Granite/lava | Cooling crust, sealed subsurface heat, heated mineral inclusions, heat-tinted metal, breathing scoria pores |
| Imperial | Flowing gold-bearing veins, internal jade scattering, opal-film response, directional sheen, growing mineral deposits |

All new-world cards animate while visible unless paused or reduced motion is
requested. Current-act samples can show the existing terrain effects. A single
viewport-sized WebGL context renders the visible gallery cards at up to 30 Hz.
The large scene stops drawing when outside the viewport.
Its programs are specialized and cached by world, so the compiler does not carry
the full set of environments through every material branch. The full-board
surface uses a cheaper grain approximation with the selected palette and finish;
the optical behavior is shared with its swatch.

## Preserved user selection

The original **E4 · Нефритовый договор** lives in `saved-materials.js` and is
rendered by the independent `saved-jade-source.js` program. It is not passed
through the new phenomena shader. The user-provided reference is preserved at
`public/terrain/material-studies/saved/jade-covenant-reference.png`.

The plain granite selected before the bold experiments is separately frozen in
`saved-granite-source.js`. It uses the former granite material function with no
thermal-deposition or opening-crust phenomenon. Lava is not baked into this
saved surface; it belongs to the scene's environment.

GPU read-back checks compare the saved jade preset with the former E4 rendering
(zero pixel difference). Established surface recipes retain their arithmetic;
their read-back may differ by at most one 8-bit channel level after shader
restructuring. The wall samples use continuous horizontal cuts through
dense stone/ice, matte finishes and sparse natural faults, without brick courses,
facade joints, bevels or side faces. They remain considerably darker than the
paired floors. New-world variants are checked for
distinct output and time-dependent pixels, separately from screenshots and builds.

## Existing-act terrain comparison

The second act has separate four-pair groups for forge, ice and crypt. Garden,
ruins and court each have four pairs as well. `act-study-effects.js` reuses the
game's transparent garden sprites, `drawVines`, the shared `createIceShader` heat
and ice modes, and the neutral remains assets. Each biome uses the same terrain
positions and seeds across its four material choices. The effect layer can be
hidden independently; the material remains visible underneath.

The necropolis palette is cold, damp and desaturated, with matte walls, mineral
staining, neutral remains and light ground mist. No resurrection rule is added.
Court has no implemented floor hazard and therefore keeps its clean comparison.
