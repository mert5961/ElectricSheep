# Electric Sheep

**Electric Sheep** is a web-based projection mapping and AI-driven visual orchestration system. The project takes inspiration from *Do Androids Dream of Electric Sheep?* and explores the festival theme "Do AI systems think?" through audiovisual interpretation.

Instead of simply reacting to audio signals, Electric Sheep treats sound as something that can be **interpreted**, **translated into emotion**, and **projected onto physical space**.

> The system transforms sound into visual thought.

---

## Try It Live

GitHub Pages build:

[https://mert5961.github.io/ElectricSheep/](https://mert5961.github.io/ElectricSheep/)

Control workspace:

[https://mert5961.github.io/ElectricSheep/control.html](https://mert5961.github.io/ElectricSheep/control.html)

Projection output:

[https://mert5961.github.io/ElectricSheep/output.html](https://mert5961.github.io/ElectricSheep/output.html)

---

## Core Idea

Electric Sheep allows users to define projection surfaces on real-world objects and map shader-based visuals onto them. Later, AI systems interpret audio input and modify visual parameters to create a generative audiovisual performance.

**Typical example:** A user projects visuals onto kitchen cabinets or architectural surfaces. Each cabinet door becomes a digital surface in the editor. Visual shaders can then be mapped individually or shared across multiple surfaces.

---

## System Architecture

Electric Sheep is designed as a **three-layer pipeline**.

### 1. Geo Master — The geometry editing layer

Geo Master defines *where* visuals appear in physical space. Users create and edit digital surfaces that correspond to real projection targets.

**Features:**
- Web-based canvas editor
- Multiple projection surfaces
- 4-corner surface manipulation (quad warping)
- Independent content quad framing per surface
- Multiple subtract quads per surface for exclusion regions
- Real-world alignment (e.g. cabinets, walls, panels)
- Feather edge blending
- Surface selection and deletion
- Show mode for clean projection output

Each surface represents geometry only, not content.

**Example surface state:**

```json
{
  "id": "surface-1",
  "name": "Cabinet Left Door",
  "surfaceQuad": [
    {"x": 120, "y": 80},
    {"x": 280, "y": 75},
    {"x": 290, "y": 310},
    {"x": 115, "y": 320}
  ],
  "contentQuad": [
    {"x": 120, "y": 80},
    {"x": 280, "y": 75},
    {"x": 290, "y": 310},
    {"x": 115, "y": 320}
  ],
  "subtractQuads": [
    {
      "quad": [
        {"x": 155, "y": 130},
        {"x": 235, "y": 128},
        {"x": 150, "y": 232},
        {"x": 240, "y": 230}
      ],
      "feather": 0.04,
      "visible": true,
      "order": 0
    }
  ],
  "activeSubtractQuadIndex": 0,
  "feather": 0.15,
  "order": 1,
  "visible": true,
  "assignedOutputId": "output-1"
}
```

### 2. Shader Master — The visual content layer

Shader Master defines *what* is displayed on the surfaces. Visuals are shader-based and controlled through parameters.

**Key principles:**
- Shader parameters are controlled through JSON
- One shader can drive multiple surfaces
- Each surface can have its own shader
- Shader logic is independent from geometry

**Example visual source:**

```json
{
  "id": "output-1",
  "type": "shader",
  "shaderPresetId": "dream-gradient",
  "params": {
    "u_color": [0.8, 0.2, 1.0],
    "u_speed": 0.4,
    "u_intensity": 0.7
  }
}
```

This separation allows flexible routing between visual sources and projection surfaces.

### 3. LLM Master of Feelings — The AI interpretation layer

This system analyzes audio input and asks an LLM to interpret its emotional or conceptual character. The LLM then generates shader parameter updates in JSON format.

**Example:**

```json
{
  "surfaceTargets": ["surface-1", "surface-2"],
  "preset": "dream_pulse",
  "uniforms": {
    "u_color": [0.9, 0.3, 1.0],
    "u_speed": 0.6,
    "u_noiseAmount": 0.5
  }
}
```

Instead of raw signal reaction, the system becomes a **conceptual interpreter of sound**.

---

## Key Architectural Principle

**Geometry and visual content must remain independent.**

| Surface objects define | Visual outputs define |
|------------------------|------------------------|
| position | shaders |
| shape | parameters |
| feather | animation logic |
| visibility | |

This separation enables:
- one visual across many surfaces
- different visuals per surface
- dynamic reassignment during performances

---

## Target Use Cases

- Media art festivals
- Generative audiovisual installations
- Projection mapping performances
- AI-driven visual experimentation

---

## Technical Principles

- Web-based system
- WebGL / Three.js rendering
- JSON-based scene state
- Modular OOP architecture
- Real-time shader rendering
- Future AI integration

---

## Conceptual Statement

Electric Sheep does not simply analyze sound. It **interprets** it, **translates** it into emotion, and **projects** it onto space.

---

## License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details.

---

## Installation

Requirements:

- Node.js 18+ recommended
- npm

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Build the GitHub Pages version:

```bash
npm run build:pages
```

Note:

- The public GitHub Pages version is static and works in the browser without install.
- Local development uses Ollama by default through [src/systems/shader-master/runtime/getAIState.ts](/Users/mertbarut/Desktop/ElectricSheep/src/systems/shader-master/runtime/getAIState.ts).
- The public GitHub Pages version can use a hosted AI backend by setting `VITE_AI_BACKEND_URL` during the GitHub Pages build.

## Hosted AI Setup

Electric Sheep now supports two AI modes:

- `local`: calls Ollama on `http://localhost:11434/api/generate`
- `remote`: calls a hosted backend endpoint that returns the same `{ response }` payload shape

If `VITE_AI_BACKEND_URL` is set, the app automatically prefers the hosted backend. If it is not set, the app falls back to local Ollama.

### Cloudflare Worker + OpenRouter

The repository includes a ready-to-deploy Cloudflare Worker in [workers/openrouter-ai/src/index.ts](/Users/mertbarut/Desktop/ElectricSheep/workers/openrouter-ai/src/index.ts).

1. Install Wrangler if you do not already have it:

```bash
npm install -g wrangler
```

2. Log in to Cloudflare:

```bash
wrangler login
```

3. Create a local worker env file from [workers/openrouter-ai/.dev.vars.example](/Users/mertbarut/Desktop/ElectricSheep/workers/openrouter-ai/.dev.vars.example):

```bash
cp workers/openrouter-ai/.dev.vars.example workers/openrouter-ai/.dev.vars
```

4. Set the production OpenRouter key as a Cloudflare secret:

```bash
wrangler secret put OPENROUTER_API_KEY --config workers/openrouter-ai/wrangler.toml
```

5. Deploy the worker:

```bash
wrangler deploy --config workers/openrouter-ai/wrangler.toml
```

6. In GitHub, set these repository variables for the Pages build:

- `VITE_AI_BACKEND_URL`
  Example: `https://electric-sheep-ai.<your-subdomain>.workers.dev/ai-state`
- `VITE_AI_MODE`
  Recommended value: `remote`

7. Push to `main` or rerun the GitHub Pages workflow.

### Worker Environment Variables

- `OPENROUTER_API_KEY`
  Required. Keep this secret in Cloudflare only.
- `OPENROUTER_MODEL`
  Optional. Defaults to `qwen/qwen3.6-plus:free`.
- `ALLOWED_ORIGINS`
  Optional comma-separated list.
  Example: `http://localhost:5173,https://mert5961.github.io`
- `OPENROUTER_SITE_URL`
  Optional referer header for OpenRouter.
- `OPENROUTER_APP_NAME`
  Optional display title for OpenRouter analytics.
