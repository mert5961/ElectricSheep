# Master Organism Shader Roadmap

## Current Architecture Snapshot

Shader Master v2 is currently organized around a small preset registry of fully separate fragment shaders:

- `debug-grid`: calibration and readable signal debugging
- `cabinet-lines`: graphic, architectural line field
- `dream-gradient`: soft atmospheric flow
- `pulse`: kinetic concentric pulse system
- `fractured-bloom`: dramatic shard-and-bloom field
- `audio-reference`: minimal audio legibility test

The important strength in the current architecture is that feelings, audio, recipes, and manual output uniforms are already separated cleanly:

- feelings arrive as shared macro uniforms
- audio arrives as a shared bucket and can be shaped before rendering
- recipes safely choose presets and target output-level controls
- presets stay modular and Geo Master remains independent

The main artistic weakness is identity continuity. Recipes can transition safely, but they still transition between fundamentally different shader worlds.

## Recommendation

The best unification anchor is not the utility or architectural branch.

`dream-gradient`, `pulse`, and `fractured-bloom` already share the beginnings of one organism family:

- center-weighted composition
- flowing or breathing motion
- emissive body behavior
- pulse-readable modulation
- a plausible path from soft to tense to fractured

`cabinet-lines` and `debug-grid` should stay available, but they read more like side branches:

- `debug-grid` should remain a technical utility preset
- `cabinet-lines` can remain a graphic/architectural alternate voice

The recommended "master organism candidate" is therefore a new shader lineage built from the soft-to-dramatic center-field family, with `dream-gradient` as the emotional baseline and `pulse` / `fractured-bloom` folded in as behavior modes rather than separate identities.

## Proposed Organism Layers

The master organism direction should be described in semantic layers instead of disconnected preset personalities:

1. `structure`
   The body silhouette, membrane shape, internal density, and breakup tendency.
2. `motion`
   Drift, breathing, turbulence, oscillation, instability, and pressure.
3. `surface`
   Edge sharpness, detail grain, vein/ridge visibility, shimmer, and fragmentation texture.
4. `light`
   Internal emission, glow, bloom, warmth, contrast, and accent flashes.
5. `feedback`
   Memory, afterglow, trails, persistence, and accumulated pressure.

Note:
The current codebase does not yet expose a real feedback buffer inside Shader Master v2, so `feedback` should stay a roadmap layer for now rather than a forced implementation.

## Semantic Parameter Vocabulary

These are the recommended creative controls for a unified organism shader:

- `flow`: broad directional motion and field drift
- `density`: internal structural packing and richness
- `fragmentation`: breakup, tearing, discontinuity
- `instability`: pressure, agitation, wobble, sharpness
- `softness`: damping, blend softness, membrane thickness
- `glowAmount`: visible emission and halo strength
- `internalLight`: brightness inside the body core
- `scaleBreath`: body expansion and contraction
- `edgeSharpness`: membrane definition and structural pressure
- `motionTurbulence`: mid-scale deformation and fluid agitation
- `surfaceDetail`: fine ridges, veins, sparkle, grain

## Responsibility Split

### AI / feelings

AI should control macro character:

- `tension` -> instability, edge pressure, structural compression
- `warmth` -> palette temperature and emotional color drift
- `fragmentation` -> breakup tendency and discontinuity
- `glow` -> internal emission and halo
- `stillness` -> motion damping and temporal restraint
- `density` -> body richness, packing, and internal detail

### Audio

Audio should control micro modulation:

- `bass` -> body breath, large readable displacement, weight
- `mid` -> internal flow and secondary movement
- `treble` -> fine shimmer, edge activity, small accents
- `energy` -> overall activity bed and lift
- `pulse` -> short rhythmic hits, rings, flashes, contractions

### Recipes

Recipes should stay responsible for:

- selecting a safe state target
- choosing a DNA profile or preset anchor
- defining transition timing
- constraining macro mood changes over time

### DNA profiles

Profiles should become starting biases rather than separate shader identities:

- calm organism
- dense organism
- dreamy organism
- tense organism
- fragmented organism

Those profiles should eventually point at one master organism shader with different semantic defaults, instead of swapping to unrelated fragment shaders.

## Safe Migration Path

### Phase 1

Add one explicit `Organism Core` preset as a unification candidate while keeping all current presets.

Goal:
Create a selectable shader that already follows the intended responsibility split.

### Phase 2

Introduce DNA profile metadata on top of the organism shader:

- profile defaults for structure, motion, surface, and light
- recipe selection that targets profiles instead of unrelated presets

### Phase 3

Refactor the strongest shared logic from `dream-gradient`, `pulse`, and `fractured-bloom` into common organism-oriented shader utilities.

Goal:
One coherent shader body with multiple state biases instead of several separate shader identities.

### Phase 4

Keep `debug-grid`, `audio-reference`, and possibly `cabinet-lines` as utility / special-case presets, while the main artistic path lives in the organism family.

## Safe First Step Chosen In This Branch

This branch adds:

- a developer-facing roadmap note
- a new `Organism Core` preset candidate

It does **not**:

- remove existing presets
- rewrite recipes
- change Geo Master
- alter the shared audio bucket architecture
- force a destructive migration

That gives the project a real artistic north star while keeping the current system stable.
