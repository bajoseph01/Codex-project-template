# Project: 3D Infinite Runner (Learning Build)
# Standards: Three.js + glTF (Codex)

## Technical Constraints
- Framework: Vite + React + TypeScript
- Engine: Three.js (Core)
- Animation: Use 'AnimationMixer' with delta-time (clock.getDelta) for frame-rate independence.
- Rendering: Enable SRGBColorSpace and ACESFilmicToneMapping.
- Assets: Load `.gltf` (or `.glb` if you add any later) from `/public/models/`.
- Camera: Side-scroller view (camera looks along Z; movement along X).

## Infinite Runner Logic
1. **Lanes**: 3 depth lanes on Z (Near: -5, Center: 0, Far: 5).
2. **Infinite Floor**: Implement a "texture scroll" or "segment leapfrog" system.
3. **Obstacles**: Use Object Pooling. Move 'missed' obstacles to the back of the queue.
4. **Character**: Play 'Run' animation by default, 'Jump' on Space, and 'Death' on collision.
5. **Debug**: Include a `lil-gui` panel for 'Game Speed' and 'Gravity'.

## Global Rules
- If a terminal command fails, debug and retry.
- Read /public/models to identify available .glb files before coding.
- Teaching goal: explain each milestone in plain English; update `HANDOFF.md` only after big milestones.
