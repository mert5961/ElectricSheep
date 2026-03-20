# Electric Sheep Logbook

## 2026-03-20 — Audio Analyzer Signal Enrichment Pipeline

### Feature Implemented
- Added display-audio capture alongside microphone and internal debug generators so Shader Master can react to browser / app playback without requiring a physical microphone loopback.
- Expanded the analyzer output from broad buckets (`bass`, `mid`, `treble`, `energy`, `pulse`) into a richer rhythm-oriented signal set: `bassSmooth`, `hit`, `flux`, `rumble`, `kick`, `snare`, and `hihat`.
- Added an audio-visual mapping layer after analysis so each shared audio uniform can be independently enabled, thresholded, curved, gained, or soloed before presets consume it.
- Retuned the diagnostic and artistic presets so visuals can respond to more meaningful musical roles instead of only broad continuous energy.

### Architecture Changes
- The important pipeline is now:
  capture source -> FFT / waveform analysis -> raw band + energy extraction -> adaptive noise gate -> pulse / onset / enrichment passes -> shared audio bucket -> audio-visual mapping -> final shader uniforms
- `src/systems/audio-analyzer/audioAnalyzer.ts` is the central orchestrator. It reads frequency/time-domain data each frame, computes raw bands and waveform energy, gates noise, detects onsets, enriches the signal set, and writes the result into the analyzer store.
- `src/systems/audio-analyzer/noiseGate.ts` calibrates for roughly the first `500 ms` and tracks moving floors so silence and room noise do not continuously animate the scene.
- `src/systems/audio-analyzer/onsetDetector.ts` separates transient rhythm into three channels:
  `kick` for low-frequency punches, `snare` for mid-band accents, and `hihat` for high-frequency sparkle.
- `src/systems/audio-analyzer/signalEnricher.ts` adds slower and more semantically useful motion layers:
  `bassSmooth` uses a damped spring, `hit` is a peak-hold envelope, `flux` measures spectral change, and `rumble` is a slow energy accumulator.
- `src/App.js` applies the live analyzer result inside the frame loop before Shader Master renders. That means the analyzer owns the shared audio bucket while live input is active.
- `src/systems/shader-master/runtime/resolveMappedAudioUniforms.ts` applies per-signal threshold, curve, gain, and solo filtering after analysis. This is a shaping stage, not the detector itself.
- `src/systems/shader-master/ui/DebugSignalsPanel.ts` exposes the critical debugging split:
  `Raw` = direct analyzer output, `Smoothed` = analyzer output after attack/release, `Shared` = the actual bucket Shader Master receives after store updates.

### Why This Matters
- Before enrichment, visuals could feel random or mushy because broad energy buckets are continuous and overlapping. They can show that music is present, but they are weak at expressing rhythm structure.
- The enrichment layer gives presets event-like cues (`kick`, `snare`, `hihat`) and slower intent-like cues (`bassSmooth`, `flux`, `rumble`) so visuals can lock onto pulse, accents, shimmer, and long-form breathing separately.
- If local output looks active but does not catch the rhythm, the first suspicion should be signal quality or post-mapping shape, not the shader alone.

### Files Modified
- `docs/master-organism-shader-roadmap.md`
- `src/App.js`
- `src/systems/audio-analyzer/audioAnalyzer.ts`
- `src/systems/audio-analyzer/audioAnalyzerStore.ts`
- `src/systems/audio-analyzer/energyDetector.ts`
- `src/systems/audio-analyzer/noiseGate.ts`
- `src/systems/audio-analyzer/onsetDetector.ts`
- `src/systems/audio-analyzer/signalEnricher.ts`
- `src/systems/shader-master/contracts/audioVisualMapping.ts`
- `src/systems/shader-master/contracts/uniforms.ts`
- `src/systems/shader-master/registry/presetRegistry.ts`
- `src/systems/shader-master/registry/presets/audioReference.ts`
- `src/systems/shader-master/registry/presets/dreamGradient.ts`
- `src/systems/shader-master/registry/presets/fracturedBloom.ts`
- `src/systems/shader-master/registry/presets/organismCore.ts`
- `src/systems/shader-master/registry/presets/pulse.ts`
- `src/systems/shader-master/ui/DebugSignalsPanel.ts`
- `src/systems/shader-master/ui/ShaderTab.ts`
- `src/systems/shader-master/validation/resolveVisualStateRecipe.ts`
- `src/ui/UIManager.js`

### Notes For Future Development
- Use the `audio-reference` preset first when diagnosing rhythm problems. It is the clearest way to confirm whether `kick`, `snare`, `hihat`, `bassSmooth`, `flux`, and `rumble` are arriving in the way the presets expect.
- Treat analyzer extraction and audio-visual mapping as separate debugging layers. If `Raw` already looks wrong, fix detector logic or input quality first. If `Raw` looks good but `Shared` feels weak or noisy, adjust mapping thresholds / gain / curve.
- `u_audioPulse` is still useful for backward compatibility, but newer preset work should prefer the enriched channels over trying to force everything through one generic pulse signal.
- Manual audio sliders become read-only mirrors while live input is running. That is intentional: the analyzer owns the shared bucket during live capture.
- Display audio is convenient for rehearsal and browser playback, but browser / OS capture behavior can color the input. If rhythm feels unstable, compare microphone, display audio, and debug generators before retuning presets.

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
