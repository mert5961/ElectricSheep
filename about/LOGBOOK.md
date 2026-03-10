# Electric Sheep Logbook

## 2026-03-10 — Subtract Feather And Surface Layer Order

### Feature Implemented
- Added per-subtract-quad feather values so internal cutout edges can fade softly instead of rendering as hard boolean holes.
- Added explicit surface layer ordering with editor controls for `To Front`, `To Back`, `Forward`, and `Backward`.
- Kept show mode clean so only final rendered output remains visible while subtract feather and surface ordering still affect the image.

### Architecture Changes
- Extended `Surface` state with a serializable `order` field and promoted subtract quads from raw point arrays to structured entries with `quad`, `feather`, `visible`, and `order`.
- Added explicit ordering methods in `SurfaceManager` so Geo Master owns stacking rules instead of relying on map insertion order.
- Kept subtract feather in the Geo Master mask path: the shader only receives precomputed subtract transforms plus feather values and applies them to final alpha.

### Files Modified
- `README.md`
- `about/LOGBOOK.md`
- `src/App.js`
- `src/shaders/ShaderMaterialFactory.js`
- `src/shaders/debug.frag.glsl`
- `src/surfaces/Surface.js`
- `src/surfaces/SurfaceConstants.js`
- `src/surfaces/SurfaceManager.js`
- `src/ui/UIManager.js`

### Notes For Future Development
- Subtract feather currently fades inward from the subtract edge; it is intended as a projection-friendly soft exclusion, not a general polygon blur system.
- Surface ordering is explicit and serialized through `surface.order`; keep future render-layer features aligned with that field rather than falling back to incidental array order.
- Subtract quad `order` is included for stable editing/data consistency, but subtract masks still combine multiplicatively, so subtract order is not yet a visual compositing feature.
- If future work introduces shader routing or non-rectangular masks, keep that separate from Geo Master’s quad placement and stacking responsibilities.

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
