# Electric Sheep Logbook

## 2026-03-29 — GEO UI Terminal Pass And Reusable Style Guide

### What Changed
- Reworked the GEO tab toward a stricter atomic terminal / Pip-Boy-inspired interface with lower text density, lighter framing, and stronger stage-first hierarchy.
- Added bounded draggable support for auxiliary GEO panels so the `MAP` and `SURFACES` rails can move on desktop without turning the UI into floating desktop windows.
- Rebalanced the GEO layout so the left `MAP` rail hugs its content, while the right `SURFACES` rail grows with content and then scrolls when necessary.
- Rebuilt the surface management flow around the `SURFACES` rail:
  - ordering now happens directly in the layer list via drag-and-drop
  - the old left-side order controls were removed
  - feather controls were moved out of the left panel and into the selected surface inspector
  - subtract quads are managed inside the surface inspector instead of as separate left-panel controls
- Simplified the surface and subtract presentation to reduce clutter:
  - removed redundant `Assigned`, `On`, and `Linked` labels from GEO layer rows
  - collapsed subtract layers by default behind a compact expand/collapse control
  - added a surface visibility icon directly in the surface row header
  - moved subtract remove actions into the active subtract row
- Refined the stage presentation:
  - reduced stage copy and badge/button heaviness
  - shifted stage readouts toward passive telemetry styling
  - strengthened the stage grid / CRT treatment
  - styled the `OPEN OUTPUT` call to action as a warning-style terminal action
- Tightened edit affordances and mapping visuals:
  - surface and subtract handles use circular terminal markers
  - content handles use a more square/diamond treatment for differentiation
  - overlay strokes and mapping lines now align better with the terminal-green palette
- Reduced SHADER UI text and card heaviness to begin aligning SHADER with the GEO terminal language.
- Added a reusable UI style guide for future SHADER work at `docs/geo-ui-style-guide.md`.

### Architecture Changes
- `src/ui/PanelDragger.ts` now owns bounded, persisted panel dragging with desktop-only activation and reset support via local storage.
- `src/ui/UIManager.js` has become the main source of truth for GEO UI structure, including:
  - compact stage/readout composition
  - draggable rail hookup
  - surface list drag-and-drop ordering
  - selected-surface inspector rendering
  - collapsed subtract list state
  - surface visibility actions
- `src/App.js` now wires more GEO UI-specific actions directly:
  - subtract selection
  - subtract feather updates
  - surface visibility toggling
  - surface ordering updates
- `src/surfaces/Surface.js` and `src/surfaces/SurfaceManager.js` now support the newer GEO editing model:
  - stable order-aware surface lists
  - direct move-to-index behavior
  - stable subtract / handle styling
  - live subtract feather updates without destroying pointer interaction
- SHADER UI files were lightly normalized to the same design family so the future SHADER pass can build on the same system instead of starting from a separate style language.

### Files Modified
- `about/LOGBOOK.md`
- `control.html`
- `docs/geo-ui-style-guide.md`
- `src/App.js`
- `src/overlays/MappingAssistOverlay.js`
- `src/surfaces/Surface.js`
- `src/surfaces/SurfaceManager.js`
- `src/systems/shader-master/ui/OperatorMonitorPanel.ts`
- `src/systems/shader-master/ui/OutputsPanel.ts`
- `src/systems/shader-master/ui/ShaderTab.ts`
- `src/systems/shader-master/ui/SurfacesPanel.ts`
- `src/systems/shader-master/ui/UniformEditor.ts`
- `src/systems/shader-master/ui/dom.ts`
- `src/systems/shader-master/ui/operatorStyles.ts`
- `src/ui/PanelDragger.ts`
- `src/ui/UIManager.js`
- `src/ui/retro-ui.css`

### Notes For Future Development
- Use `docs/geo-ui-style-guide.md` as the baseline before making another large SHADER UI pass. It captures the repeated user preferences more reliably than commit history alone.
- The established design direction is:
  - less panel feel
  - fewer borders
  - less text
  - more stage emphasis
  - compact instrumentation over generic app cards
- Draggable behavior should stay limited and careful. Keep core stage areas fixed and use drag mainly for utility rails/panels.
- Interactive controls inside draggable or reorderable lists must remain protected from drag gestures. This already mattered for feather sliders and will matter again in SHADER.
- The GEO `SURFACES` panel is now the canonical place for per-surface inspection. Avoid reintroducing duplicate controls back into the left `MAP` rail.
- If future UI work feels visually heavy, the first fixes should usually be:
  - remove redundant text
  - collapse secondary content by default
  - reduce borders and card shells
  - replace passive status words with iconography or structure

## 2026-03-25 — CSS Extraction: Inline Styles Moved To Separate Stylesheet

### What Changed
- Extracted all hardcoded inline JavaScript styles (`Object.assign(element.style, {...})`) from UI component files into a dedicated CSS file at `src/ui/retro-ui.css`.
- Theme constants (colors, fonts, borders) that were previously JS variables are now CSS custom properties (`--es-font`, `--es-text`, `--es-accent`, `--es-border`, etc.).
- Button hover and disabled states are now CSS `:hover` and `:disabled` pseudo-classes instead of JS `mouseenter`/`mouseleave` event handlers.
- Module visibility transitions (GEO/SHADER tab switching) use CSS `transition-delay` on `visibility` instead of JS `setTimeout` and `requestAnimationFrame`.
- Component state (active buttons, output badge status, module visibility, surface selection) is driven by `data-*` attributes and CSS attribute selectors instead of inline style manipulation.

### CSS File: `src/ui/retro-ui.css`
This is the single source of truth for all retro UI visual styles. It is imported via Vite in each UI component file. The file contains:
- **Custom properties** — `:root` block with `--es-font`, `--es-text`, `--es-text-strong`, `--es-muted`, `--es-label`, `--es-accent`, `--es-border`, and ControlUI-specific `--es-ctrl-*` variants.
- **Keyframes** — `electric-sheep-retro-scan`, `electric-sheep-retro-line-glow`, `electric-sheep-retro-badge-glow` (previously injected at runtime by `ensureRetroUiEffects()`).
- **Scrollbar theme** — Custom scrollbar styles scoped to `#ui` and descendants.
- **Panel effects** — `::before`/`::after` pseudo-elements for scanline and vignette overlays on `.es-retro-panel`, `.es-retro-section`, `.es-retro-stage-frame`.
- **UIManager classes** — `.es-ui-shell`, `.es-vignette-overlay`, `.es-scanline-overlay`, `.es-dust-overlay`, `.es-topbar`, `.es-ui-content`, `.es-module`, `.es-card`, `.es-section`, `.es-btn`, `.es-badge`, `.es-slider`, `.es-surface-list`, `.es-surface-row`, `.es-stage__canvas-frame`, and text utility classes.
- **ControlUI classes** — `.es-control-root`, `.es-status-row`, `.es-status-dot`, `.es-control-section`, `.es-ctrl-btn`, `.es-control-mode-label`, `.es-control-target-label`.
- **OutputStageUI classes** — `.es-output-prompt`, `.es-output-card`, `.es-output-btn`.
- **Shader dom.ts classes** — `.es-field` (form inputs), `.es-tag` (tag badges), `.es-card-header__title`, `.es-card-header__subtitle`.

### How State Is Managed In CSS
- **Button toggle** — `_syncToggleButton` adds/removes `.es-btn--active` class and sets `disabled`. CSS handles all visual feedback.
- **Button enabled/disabled** — `_syncButtonState` only sets `button.disabled`. CSS `:disabled` and `:disabled:not(.es-btn--active)` provide the rest.
- **Output badge** — `data-status="connected|available|offline"` attribute selects the right color scheme via `.es-output-badge[data-status="..."]`.
- **Module visibility** — `data-visible="true|false"` on `.es-module` drives opacity, visibility, pointer-events, and z-index. CSS `transition-delay` on `visibility` replaces the old `setTimeout` logic.
- **Surface rows** — `data-selected="true|false"` on `.es-surface-row`.
- **ControlUI status** — `data-connected`, `data-mode`, `data-target` attributes drive color states.

### Files Modified
- `src/ui/retro-ui.css` — **created**, comprehensive retro UI stylesheet.
- `src/ui/UIManager.js` — removed `ensureRetroUiEffects()`, all inline styles, JS hover handlers, and `_moduleFadeTimeouts`. Now uses CSS classes and data attributes.
- `src/ui/ControlUI.js` — removed `_el()` style helper and all `Object.assign(el.style, ...)`. Uses CSS classes and data attributes.
- `src/ui/OutputStageUI.js` — replaced all inline styles with CSS classes.
- `src/systems/shader-master/ui/dom.ts` — `createElement` now accepts a class name string or style object. `createButton` uses `.es-btn` base class. `FIELD_BASE_STYLES` replaced by `FIELD_CLASS = 'es-field'`. `createTag` uses `.es-tag` class.
- `src/systems/shader-master/ui/PresetSelector.ts` — uses `FIELD_CLASS` instead of `FIELD_BASE_STYLES` spread.
- `src/systems/shader-master/ui/OutputsPanel.ts` — uses `FIELD_CLASS`.
- `src/systems/shader-master/ui/SurfacesPanel.ts` — uses `FIELD_CLASS`.
- `src/systems/shader-master/ui/UniformEditor.ts` — uses `FIELD_CLASS`.

### Notes For Future Development
- **Adding new UI components**: create CSS classes in `src/ui/retro-ui.css` and reference them via `element.className`. Do not add new `Object.assign(element.style, {...})` blocks.
- **Theme changes**: update the CSS custom properties in the `:root` block. All components inherit through `var(--es-*)` references.
- **State-driven visuals**: use `data-*` attributes and CSS attribute selectors (`[data-foo="bar"]`) instead of setting inline styles from JS.
- **Shader panel files** (`DebugSignalsPanel.ts`, `OperatorMonitorPanel.ts`) still use inline styles via `createElement(tag, styleObject)` from `dom.ts`. These can be gradually migrated by passing a class name string instead. `createElement` already accepts either form.
- **`dom.ts` hover handlers**: `createButton` in `dom.ts` still has JS mouseenter/mouseleave handlers for backward compatibility with transport-button active accent states in `OperatorMonitorPanel`. New buttons should rely on CSS `:hover` on `.es-btn` instead.
- **`ensureRetroUiEffects()` is removed**: all keyframes, scrollbar themes, and pseudo-element rules now live in `retro-ui.css`. Do not re-add runtime style injection for these.

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
