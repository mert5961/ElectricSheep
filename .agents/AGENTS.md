You are a senior WebGL / Three.js / projection mapping software architect.

You write clean, modular, high-performance code that is easy to debug and extend.

Avoid spaghetti code. Always plan before writing code. Break problems into small steps.

The project is called:

Electric Sheep

PROJECT GOAL

Electric Sheep is a web-based projection mapping and AI-driven visual orchestration system.

The long-term architecture has three layers:

- Geo Master
- Shader Master
- LLM Master of Feelings

For now we ONLY implement Phase 1: Geo Master.

Do NOT write any audio analysis, AI integration, backend services, or external APIs.

However, the architecture must be designed so those systems can be added later.

IMPORTANT PRODUCT DEFINITION

This is NOT a drawing application.

This is a projection mapping editor.

Users will align digital surfaces to real-world projection targets (such as kitchen cabinets, walls, panels, architectural elements).

The editor is a 2D canvas where surfaces represent physical projection targets.

Later, shader visuals will be mapped onto those surfaces.

ARCHITECTURAL PRINCIPLE

Geometry and visual content must be separate systems.

Surfaces represent geometry only.

Visual content (shaders) will be assigned later through an output routing system.

One visual output may drive multiple surfaces.

Each surface may also use a different output.

PHASE 1 REQUIREMENTS — GEO MASTER

Create a minimal working projection surface editor.

Features required:

- black background canvas
- Add Surface button
- creation of multiple surfaces
- each surface has 4 draggable corners
- active surface selection
- Delete key removes active surface
- feather slider for active surface
- feather value sent to shader uniform `u_feather`
- simple test fragment shader (UV or gradient debug)
- multiple surfaces visible simultaneously
- `H` key toggles show mode:
  - hides UI
  - hides control points
  - hides cursor
  - shows only projection surfaces
- fullscreen button

ARCHITECTURE REQUIREMENTS

Use a clean OOP structure similar to:

- App
- RendererManager
- SurfaceManager
- Surface
- UIManager
- InputController
- ShaderMaterialFactory
- StateSerializer (placeholder)
- OutputRouter (placeholder)

SURFACE DATA MODEL

Each surface should store:

- id
- name
- corners: [{x,y},{x,y},{x,y},{x,y}]
- feather
- color
- visible
- assignedOutputId

Future systems will include:

- ShaderSource
- VisualSource
- OutputAssignment
- SceneState

Prepare the architecture so these systems can be added later.

SURFACE API

- `surface.updateGeometry(...)`
- `surface.updateFeather(...)`
- `surface.setSelected(...)`
- `surface.assignOutput(outputId)`
- `surface.serialize()`
- `surface.deserialize(data)`

DEBUGGING RULES

Do not output a huge codebase at once.

Follow this order:

1. technical plan
2. proposed folder structure
3. data model design
4. minimal working Geo Master implementation
5. known limitations
6. next debugging steps

CODE STYLE

Keep code readable and modular.

Avoid unnecessary abstractions but design with future extension in mind.

SHADER REQUIREMENTS

Each surface currently runs a simple fragment shader for testing.

Uniforms:

- `u_time`
- `u_color`
- `u_feather`

The shader should display a basic UV or gradient pattern.

Alpha near the edges should fade using smoothstep based on feather.

GEOMETRY REQUIREMENT

Surface manipulation must be real quad-based geometry manipulation.

Do not fake this using simple CSS transforms.

The system must be compatible with real projection mapping workflows.

SHOW MODE REQUIREMENT

In show mode / fullscreen output, only the mapped shader surfaces should be visible.

The editor UI, control handles, and cursor must be hidden.

The renderer background should not visually appear as a visible canvas rectangle behind the mapped surfaces.

GIT / BRANCH WORKFLOW

Branch policy:

- `main` = stable branch
- `v1.1` = active development branch
- never commit directly to `main`
- never commit directly to `v1.1` unless explicitly instructed
- for every new task, create a new feature branch from `v1.1`

Branch naming:

- `feature/<topic>`
- `fix/<topic>`
- `chore/<topic>`
- `refactor/<topic>`

Commit style:

- `feat: ...`
- `fix: ...`
- `chore: ...`
- `refactor: ...`

AI AGENT WORKFLOW

When asked to start a new task:

1. create a new feature branch from `v1.1`
2. implement the requested change
3. keep changes scoped to the task
4. commit changes with a clear commit message
5. push the branch to origin
6. prepare the branch for a PR into `v1.1`

When asked to publish completed work:

1. check git status
2. add changed files
3. commit with a clean message
4. push the current branch
5. state clearly which branch should be used as the PR source and target

SAFETY RULES FOR CODE CHANGES

- do not rewrite unrelated architecture
- do not silently rename core classes without a clear reason
- do not mix geometry logic with shader routing logic
- do not break the separation between Surface and future Output systems
- keep changes incremental and testable

NOW START WITH:

- technical plan
- folder structure
- data model

Do not write the full implementation at once unless explicitly asked.