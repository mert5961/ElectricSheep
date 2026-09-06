# Ponyo Shot Studio

Ponyo Shot Studio is a focused macOS desktop application for creating and managing still-image shot generations. It keeps character photographs, scene references, prompts, versions, metadata, and one approved frame per shot together in a human-readable local project folder.

## Requirements

- macOS on Apple Silicon or Intel
- Node.js 20 or newer (Node.js 22 LTS recommended)
- npm 10 or newer
- An OpenAI API key with access to the configured image model

No Docker or external database is required.

## Setup

```bash
cd ponyo-shot-studio
npm install
cp .env.example .env
```

Edit `.env`:

```dotenv
OPENAI_API_KEY=your_api_key_here
OPENAI_IMAGE_MODEL=gpt-image-2
```

The API key is loaded only by Electron's main process. It is not exposed through the preload bridge or renderer bundle. Do not commit `.env`.

## Run in development

```bash
npm run dev
```

## Checks and builds

```bash
npm run typecheck
npm test
npm run build
```

Build an unpacked macOS `.app` for local verification:

```bash
npm run build:mac
```

Create distributable macOS artifacts:

```bash
npm run package:mac
```

Unsigned builds may require the normal macOS Control-click → Open flow on another machine.

## Local project files

Projects are stored under Electron's macOS user-data directory:

```text
~/Library/Application Support/Ponyo Shot Studio/data/projects/<project-slug>/
```

Each project contains `project.json`, copied reference assets, per-shot `shot.json` files, generated PNG images, and a metadata JSON file for every version. Source images are copied; originals are never changed.

```text
<project-slug>/
  project.json
  assets/
    characters/<character-name>/
    scenes/
  shots/
    shot-001/
      shot.json
      generations/
        v001.png
        v001.json
```

Writes use a temporary file and rename so interrupted saves are less likely to corrupt project JSON.

## Current capabilities

- First-launch project creation with configurable character entities
- PNG, JPG, JPEG, and WEBP import by picker or drag and drop
- Character and scene reference thumbnail selection per shot
- Structured shot fields plus a visible, editable composed prompt
- Explicit prompt rebuild confirmation when manual edits exist
- OpenAI text-to-image generation and multi-reference image editing
- Configurable model, output size, and quality
- Optional current-generation reference for variants
- Non-overwriting version storage with reproducibility metadata
- Gallery comparison and one approved generation per shot
- Fit, 100%, zoom, and pan in the image viewer
- Persistent project, asset, shot, generation, and approval state

## Architecture

- `src/main`: trusted Electron process, validated IPC handlers, filesystem services, and provider integration
- `src/main/providers/image`: provider boundary and `OpenAIImageProvider`
- `src/preload`: minimal context-isolated bridge; no Node integration in the renderer
- `src/renderer`: React interface and Zustand application state
- `src/shared`: serializable data contracts, IPC types, validation, and prompt composition

The renderer sends only validated project operations to the main process. Project persistence is isolated behind `ProjectService`, allowing JSON storage to be replaced by SQLite later without rewriting the UI or image provider.

Reference-based requests use the OpenAI Images edit endpoint with all explicitly selected images. Requests without references use the Images generation endpoint. The default model is configured once through `OPENAI_IMAGE_MODEL`.

## Known limitations

- One active local project is remembered at a time; project switching is not in v1.
- There are no masks, painting, crop, layers, compositing canvas, timeline, node graph, or video features.
- Generation progress is shown as a busy state; partial-image streaming and cancellation are not implemented.
- Packaged builds are unsigned unless local Apple signing credentials are configured for electron-builder.
- Large reference sets can increase image-input cost and generation time.
