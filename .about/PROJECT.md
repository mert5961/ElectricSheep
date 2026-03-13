      
⚡ ELECTRIC SHEEP ⚡


# Electric Sheep — One-Page Technical Project Description

## Project Name

Electric Sheep


## Concept

Electric Sheep is a web-based projection mapping and AI-driven audiovisual interpretation system.

The project takes inspiration from **Do Androids Dream of Electric Sheep?** and explores the festival theme:

**“Do AI systems think?”**

Instead of simply reacting to sound signals, Electric Sheep treats sound as something that can be **heard, interpreted, and emotionally translated**.

The system attempts to answer a speculative question:

**How might an artificial system feel about the sound it hears?**

Those interpreted feelings are then expressed visually through projection mapping.

Electric Sheep does not simply visualize sound.

It **turns sound into visual thought projected onto physical space.**


## Core Idea

Electric Sheep allows users to define projection surfaces on real-world objects and map shader-based visuals onto them.

Later, an AI interpretation layer listens to audio input and modifies visual parameters to produce a generative audiovisual response.

Example scenario:

A user projects visuals onto kitchen cabinets or architectural panels.

Each cabinet door becomes a digital projection surface.

Visual shaders can then be mapped individually or shared across multiple surfaces.

When sound is introduced into the system, Electric Sheep listens, interprets, and transforms the sound into visual expression.


## System Architecture

Electric Sheep is designed as a layered interpretation pipeline.

The system separates **measurement**, **interpretation**, and **visual expression**.

Audio Input  
↓  
Audio Analyzer  
↓  
Master of Feelings (AI Interpretation)  
↓  
Shader Master  
↓  
Geo Master  
↓  
Projection Output


## 1. Geo Master

The geometry editing layer.

Geo Master defines **where visuals appear in physical space.**

Users create and edit projection surfaces corresponding to real objects.

Examples:

- cabinet doors  
- walls  
- panels  
- architectural surfaces  

Geo Master is responsible only for spatial framing.

It does not define visual content.


### Features

- Web-based projection canvas  
- Multiple projection surfaces  
- 4-corner quad warping  
- Real-world alignment  
- Feather edge blending  
- Surface selection and deletion  
- Clean show mode for projection output  


### Surface Structure

Surfaces are intentionally simple.

Each surface supports:

- **Surface Quad** — projection geometry  
- **Content Quad** — internal placement of shader content  
- **Subtract Quads** — simple rectangular regions where shader output is hidden  

This allows internal framing and masking without turning Geo Master into a complex mesh editor.

Example surface state:

{
  "id": "surface-1",
  "surfaceQuad": [
    {"x":120,"y":80},
    {"x":280,"y":75},
    {"x":290,"y":310},
    {"x":115,"y":320}
  ],
  "contentQuad":[
    {"x":0.1,"y":0.1},
    {"x":0.9,"y":0.1},
    {"x":0.9,"y":0.9},
    {"x":0.1,"y":0.9}
  ],
  "subtractQuads":[],
  "feather":0.15,
  "visible":true,
  "assignedOutputId":"output-1"
}

Geo Master defines **spatial framing**, not visuals.


## 2. Shader Master

The visual rendering layer.

Shader Master defines **what appears on the projection surfaces.**

Visuals are shader-based and controlled through parameters.


### Key Principles

- Visual parameters are controlled through JSON  
- One shader can drive multiple surfaces  
- Each surface can have different visuals  
- Geometry and visuals remain independent  


Example visual source:

{
  "id":"output-1",
  "type":"shader",
  "shaderPresetId":"dream-gradient",
  "params":{
    "u_color":[0.8,0.2,1.0],
    "u_speed":0.4,
    "u_intensity":0.7
  }
}

Shader Master renders the visual layer and maps it onto surfaces defined by Geo Master.


## 3. Audio Analyzer

The measurement layer.

Electric Sheep listens to sound through a microphone.

A real-time audio analysis script extracts measurable characteristics of the sound.

Typical analyzed features include:

- bass energy  
- mid energy  
- treble energy  
- overall loudness  
- spectral brightness  
- rhythmic density  
- dynamic change  


Example audio summary:

{
  "energy":0.72,
  "bass":0.81,
  "mid":0.49,
  "treble":0.27,
  "brightness":0.33,
  "rhythmicDensity":0.76
}

The Audio Analyzer **measures sound but does not interpret it.**


## 4. Master of Feelings

The AI interpretation layer.

This system represents the conceptual core of the project.

Instead of reacting directly to sound measurements, the system asks an AI model to interpret the audio summary.

The AI attempts to answer questions such as:

- How does this sound feel?  
- What emotional character does this sound carry?  
- What visual state should represent this sound?  


The result is a **visual intention JSON**.

Example AI output:

{
  "feltResponse":"I feel enclosed and rhythmically tense.",
  "visualIntent":{
    "preset":"fractured_bloom",
    "uniforms":{
      "u_feelTension":0.71,
      "u_feelFragmentation":0.63,
      "u_feelGlow":0.18
    }
  }
}

The AI does not control geometry.

It only proposes visual changes.


## Reactive vs Reflective Behavior

Electric Sheep supports two visual layers.


### Reactive Layer

Direct audio-to-visual mapping.

Audio Analyzer values continuously influence shader parameters.

Examples:

- bass → pulse intensity  
- treble → sparkle/noise  
- energy → brightness  


### Reflective Layer

Triggered interpretation.

When the user asks:

Do Androids Dream of Electric Sheep?  
What do you feel?

The system sends an audio summary to the AI model.

The AI responds with a **visual interpretation**.


## Interaction Scenario

Example performance flow:

1. A user says **"Wake up"**

The microphone begins listening.

2. Music is played from a phone or speaker.

The system analyzes sound characteristics.

3. The user asks:

Do Androids Dream of Electric Sheep?

4. The AI interprets the audio state.

5. Shader parameters update and the projection transforms.

The projection becomes a visual expression of the AI’s interpretation.


## Key Architectural Principle

The system strictly separates layers.

Geo Master → spatial framing  
Shader Master → visual expression  
Audio Analyzer → measurement  
Master of Feelings → interpretation  

This separation ensures flexibility and prevents coupling between systems.


## Target Use Cases

- media art festivals  
- generative audiovisual installations  
- projection mapping performances  
- AI-driven visual experiments  


## Technical Principles

- Web-based system  
- WebGL / Three.js rendering  
- modular OOP architecture  
- JSON-based scene state  
- shader-based rendering  
- microphone audio analysis  
- AI-assisted interpretation  


## Conceptual Statement

Electric Sheep does not simply visualize sound.

It listens.

It interprets.

And it projects its thoughts onto space.

                   
                   ⚡ ELECTRIC SHEEP SYSTEM ⚡


                          MICROPHONE
                               │
                               │
                               ▼
                    ┌────────────────────┐
                    │   AUDIO ANALYZER   │
                    │                    │
                    │  bass              │
                    │  mid               │
                    │  treble            │
                    │  energy            │
                    │  brightness        │
                    │  rhythmic density  │
                    └────────────────────┘
                               │
                               │ audio summary
                               ▼
                  ┌──────────────────────────┐
                  │   MASTER OF FEELINGS     │
                  │        (AI / LLM)        │
                  │                          │
                  │ interprets the sound     │
                  │ produces visual intent   │
                  │ returns shader JSON      │
                  └──────────────────────────┘
                               │
                               │ visual intent JSON
                               ▼
                    ┌────────────────────┐
                    │    SHADER MASTER   │
                    │                    │
                    │ shader presets     │
                    │ uniforms           │
                    │ visual state       │
                    └────────────────────┘
                               │
                               │ visual output
                               ▼
                     ┌──────────────────┐
                     │     GEO MASTER   │
                     │                  │
                     │ projection       │
                     │ surfaces         │
                     │ quad warping     │
                     │ feather edges    │
                     │ content quads    │
                     │ subtract quads   │
                     └──────────────────┘
                               │
                               │ mapped visuals
                               ▼
                        ┌──────────────┐
                        │  PROJECTOR   │
                        │              │
                        │  PHYSICAL    │
                        │  SPACE       │
                        └──────────────┘
                               │
                               ▼
                        REAL WORLD OBJECTS
                     (cabinets / walls / panels)



               ───────────────────────────────────
                       TWO VISUAL BEHAVIOR LAYERS
               ───────────────────────────────────


          REACTIVE LAYER
          ----------------
          Audio Analyzer directly drives shader uniforms

              bass      → pulse
              treble    → noise / sparkle
              energy    → brightness
              rhythm    → motion speed



          REFLECTIVE LAYER
          -----------------
          Triggered interpretation by AI

              "Wake up"

                     ↓

              audio listening phase

                     ↓

              "Do Androids Dream of Electric Sheep?"

                     ↓

              AI interprets sound

                     ↓

              new visual intention



                 FINAL RESULT

        The AI does not simply react to sound.

                It listens.

                It interprets.

                It projects its thoughts onto space.


           
