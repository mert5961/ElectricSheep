# Electric Sheep Logbook

## 2026-03-10 — Subtract Quad Regions

### Feature Implemented
- Added subtract quad regions to Geo Master so each surface can define multiple internal exclusion quads.
- Added `Subtract` as an editor target alongside `Surface` and `Content`.
- Added editor controls to create, remove, and cycle subtract quads on the active surface.
- Applied subtract masking in rendering so shader output is hidden inside subtract regions while show mode still renders only the final result.

### Architecture Changes
- Extended the surface state model with `subtractQuads` and `activeSubtractQuadIndex`.
- Centralized Geo Master edit-target names and subtract-mask budget in `src/surfaces/SurfaceConstants.js`.
- Reused quad homography math for subtract quads so surface transforms, content framing, and subtract masking all stay in the same geometry layer.
- Kept the debug shader as a placeholder and only added the minimal uniforms/logic needed for subtract masking.

### Files Modified
- `README.md`
- `src/App.js`
- `src/core/InputController.js`
- `src/shaders/ShaderMaterialFactory.js`
- `src/shaders/debug.frag.glsl`
- `src/surfaces/QuadTransform.js`
- `src/surfaces/Surface.js`
- `src/surfaces/SurfaceConstants.js`
- `src/surfaces/SurfaceManager.js`
- `src/ui/ControlUI.js`
- `src/ui/UIManager.js`

### Notes For Future Development
- Subtract masking currently uses a fixed budget of `8` subtract quads per surface to keep the implementation simple and shader-friendly.
- Surface edits carry subtract quads with the surface transform so exclusion regions stay locked to mapped geometry.
- Content framing and subtract regions remain separate concerns: `contentQuad` affects shader placement, while `subtractQuads` affect final visibility.
- If subtract masks later need soft edges or boolean combinations, add those as explicit Geo Master features instead of folding them into shader preset logic.
