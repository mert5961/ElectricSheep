---
name: threejs-vj-core
description: "Rules for multi-surface projection mapping, UV Warping, and Three.js best practices."
---
# Three.js Geo Master Rules
- Each created surface must have its own independent `BufferGeometry` and `ShaderMaterial`.
- During Quad Warping (corner dragging), the UV coordinates of the surface must be mathematically updated to stay strictly between 0.0 and 1.0.
- STRICT RULE: When a surface is removed from the DOM or scene, you MUST call `geometry.dispose()` and `material.dispose()` to prevent memory leaks.
- Raycasting, drag-and-drop operations, and UI interactions must be handled using Vanilla JS pointer events. Do NOT use React or React Three Fiber.