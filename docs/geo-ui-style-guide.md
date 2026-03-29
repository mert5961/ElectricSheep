# GEO UI Style Guide

## Purpose
- Capture the UI direction established during the GEO tab redesign so future SHADER work can follow the same visual language.
- Translate the repeated user prompts into concrete rules instead of relying on memory.

## Core Direction
- The UI should feel like an atomic terminal / Pip-Boy-inspired instrument panel, not a modern app with a retro skin.
- Favor a "fixed core + draggable auxiliary panels" layout instead of a full floating-window desktop.
- The stage is the hero. Controls should support it, not compete with it.

## High-Level Principles
- Reduce the "panel" feeling. Avoid heavy card stacking and repeated boxed sections.
- Use fewer borders. Especially avoid thick framing around the stage header and canvas area.
- Reduce text density. GEO and SHADER should feel readable at a glance.
- Prefer info strips and telemetry readouts over button-like badges when information is passive.
- Keep interactions visually minimal, but still legible and tactile.
- Stay in the same terminal family everywhere: mono typography, green CRT language, restrained glow, subtle flicker.

## Prompt-Derived Rules

### Layout
- Keep the main canvas/stage fixed.
- Allow only secondary panels to be draggable.
- Draggable panels should not look like desktop windows.
- While dragging, panels may temporarily gain brighter border/glow feedback, but should return to the quiet state on release.
- GEO left `MAP` rail should hug its content and not stretch down the full page.
- GEO right `SURFACES` rail should grow with content, then scroll when needed.

### Borders And Framing
- Avoid thick borders around the canvas/stage.
- Avoid strong header shells unless they serve a clear functional role.
- Use soft separators, faint top borders, and light structural lines instead of boxed regions.

### Text
- Reduce helper copy aggressively.
- Prefer short labels over descriptive phrases.
- Remove redundant status text when the state can be shown with structure or iconography.
- SHADER should inherit the same compression: less prose, shorter labels, fewer repeated section notes.

### Controls
- `ADD SURFACE` should be compact, not oversized.
- Secondary actions like `Add Subtract` and `Remove` should be smaller and quieter than primary actions.
- Sliders should use the terminal track style:
  - thin line track
  - explicit filled progress segment
  - compact rectangular thumb
  - enabled thumb filled, disabled thumb hollow
- Interactive controls inside draggable structures must not trigger dragging.

### Stage
- Stage badges should behave like passive telemetry, not like buttons.
- The stage grid should be visible enough to matter.
- `OPEN OUTPUT` can use a danger / warning style because it is a required action, but it should still fit the terminal system.

### Mapping Handles
- Surface handles: circular.
- Subtract handles: circular.
- Content handles: more square / rotated-square so they are visually distinct.
- Surface and overlay linework should use the same green terminal family as the rest of the UI.

## GEO Patterns To Reuse In SHADER

### Good Patterns
- Compact topbar with bracket icon actions.
- Info readouts instead of decorative badges.
- Minimal stage footer/readout style.
- Compact stacked list sections for mode/target choices.
- Subtle drag affordance and remembered panel positions.
- Layer list as the main place for structure and inspection.

### Patterns To Avoid
- Large explanatory text blocks.
- Repeated card-inside-card layouts.
- Thick button borders everywhere.
- Heavy chrome around sections that are only informational.
- Full-height empty panels.

## Surface Panel Pattern
- Surface rows should be easy to scan and mostly single-line.
- Keep the row header clean:
  - surface name
  - visibility icon
  - drag from row summary only
- Nested subtract content should be collapsed by default.
- Expand subtracts only when needed.
- Show subtract controls in a compact dropdown/list style, not as stacked heavy cards.
- Surface feather belongs with the surface inspector, not the left map panel.
- Layer ordering should happen directly in the layer/surface panel via drag-and-drop.

## Behavior Decisions Already Established
- New surfaces appear at the top of the GEO surface list.
- Surface names should remain stable after reordering.
- The `SURFACES` rail should hide entirely when there are no surfaces.
- When the last surface is deleted, the rail should close again.
- Subtract feather should update live without breaking pointer drag.

## SHADER Translation Notes
- Reuse the GEO density target: compact, sharp, low-text.
- SHADER utility panels should feel like operator instruments, not settings forms.
- Collapse secondary detail where possible.
- Prefer headers with clear identity + small icons instead of long subtitles.
- Outputs, params, and surfaces should be scannable as lists first and inspectors second.
- If a SHADER section feels like a generic admin panel, it is probably too heavy.

## Implementation Checklist For Future UI Work
- Ask: can this text become structure or iconography?
- Ask: does this really need a border?
- Ask: does this read like a terminal instrument, not a web app card?
- Ask: should this be collapsed by default?
- Ask: is the stage/output area still visually dominant?
- Ask: are draggable elements limited to the right places?

## Files That Currently Embody This Direction
- `src/ui/UIManager.js`
- `src/ui/retro-ui.css`
- `src/ui/PanelDragger.ts`
- `src/App.js`
- `src/overlays/MappingAssistOverlay.js`
- `src/surfaces/Surface.js`
- `src/systems/shader-master/ui/ShaderTab.ts`
- `src/systems/shader-master/ui/SurfacesPanel.ts`
- `src/systems/shader-master/ui/OutputsPanel.ts`
- `src/systems/shader-master/ui/OperatorMonitorPanel.ts`
- `src/systems/shader-master/ui/UniformEditor.ts`

## Important Reminder
- Use this document as the visual/interaction baseline when improving the SHADER tab next.
- If a new SHADER idea conflicts with this guide, compare it against the original GEO goals:
  - less panel feel
  - less border weight
  - less text
  - stronger instrument-panel hierarchy
  - cleaner, denser, more intentional terminal UI
