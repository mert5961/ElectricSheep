---
name: web-audio-api
description: "Real-time audio and music analysis in the browser (FFT, Beat Detection)."
---
# Web Audio API Rules
- Microphone or system audio must be captured using `navigator.mediaDevices.getUserMedia` and connected to an `AudioContext`.
- For real-time frequency analysis, you MUST use `AnalyserNode` and extract an FFT array using `getByteFrequencyData` (e.g., 256 or 512 bins).
- The audio data must be processed 60 times per second (inside `requestAnimationFrame`), separated into bass, mid, and treble, and fed into the global `appState` and subsequently the Master Shader's `u_audio` uniforms.
- Browser security requires a user gesture to start audio. The system must wait for a "Start Audio" button click before initializing the `AudioContext`.