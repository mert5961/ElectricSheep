# Electric Sheep

**Electric Sheep** is a web-based projection mapping and AI-driven visual orchestration system. The project takes inspiration from *Do Androids Dream of Electric Sheep?* and explores the festival theme "Do AI systems think?" through audiovisual interpretation.

Instead of simply reacting to audio signals, Electric Sheep treats sound as something that can be **interpreted**, **translated into emotion**, and **projected onto physical space**.

> The system transforms sound into visual thought.

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
  "corners": [
    {"x": 120, "y": 80},
    {"x": 280, "y": 75},
    {"x": 290, "y": 310},
    {"x": 115, "y": 320}
  ],
  "feather": 0.15,
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
