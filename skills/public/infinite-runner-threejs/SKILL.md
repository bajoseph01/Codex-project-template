---
name: infinite-runner-threejs
description: >
  Build or extend a 3D infinite runner game using Vite + React + TypeScript + Three.js (core) with glTF/GLB assets in /public/models. Use when implementing runner-specific systems: 3-lane movement (-5/0/5), infinite floor (segment leapfrog or texture scroll), obstacle object pooling/recycling, AnimationMixer-driven character animations (Run default, Jump on Space, Death on collision), and a lil-gui debug panel (Game Speed, Gravity) with frame-rate independent updates via clock.getDelta.
---

# Infinite Runner (Three.js + React)

Implement a clean, frame-rate independent 3D infinite runner architecture with reusable systems (floor, obstacles, character, input, debug).

## Workflow

### 1) Confirm assets before coding
- List `/public/models` and pick: `player.gltf`/`player.glb`, `obstacle.gltf`/`obstacle.glb` (or equivalents).
- If paths contain spaces, use URL-safe paths (e.g., `encodeURI("/models/...")`).
- Prefer character assets that contain animation clips (ideally `Run`, `Jump`, `Death`; otherwise map the closest available clips).

### 2) Renderer + color management baseline
- Use `WebGLRenderer({ antialias: true })` and set:
  - `renderer.outputColorSpace = THREE.SRGBColorSpace`
  - `renderer.toneMapping = THREE.ACESFilmicToneMapping`
  - `renderer.toneMappingExposure = 1`
- In the render loop, update with delta time via `const delta = clock.getDelta()`.

### 3) Game loop contract (delta-time everywhere)
Define an update contract and call it once per frame:
- `mixer.update(delta)` for animated GLB characters.
- Movement, gravity, and collisions computed using `delta` and `gameSpeed` (units/sec).

### 4) Core gameplay constants (non-negotiable)
- Lanes: `[-5, 0, 5]` (left/center/right on X)
- Forward axis: pick one convention and stick to it (common: player at ~`z=0`, world moves toward `+z` or `-z`)
- Character:
  - Default: play `Run`
  - On Space: play `Jump` and apply vertical impulse
  - On collision: play `Death`, stop input + world motion

### 5) Infinite floor (segment leapfrog)
Prefer "segment leapfrog" (simple + deterministic):
- Create `N` floor segments (planes or GLB tiles) laid out along the forward axis.
- Each frame, move segments by `speed * delta`.
- When a segment passes the "behind player" threshold, reposition it to the front-most segment + segmentLength.

### 6) Obstacles (object pooling + recycling)
Implement a pool with a fixed number of obstacle instances:
- Spawn obstacles ahead of the player in random lanes with spaced Z offsets.
- Move obstacles with the same world speed.
- When an obstacle is missed (passed behind threshold), recycle it:
  - Move it to the back/front of the queue (depending on axis convention)
  - Assign new lane and new Z position ahead
- Keep pool objects alive; never `new Mesh()` per frame.

### 7) Collisions + state machine
- Collision: use simple bounds (Box3 / bounding sphere) and a single "dead/alive" state gate.
- On collision:
  - Enter `dead` state
  - Play `Death` once
  - Stop obstacle/floor motion

### 8) Debug controls (lil-gui)
Expose (and actually use) live-tweakable parameters:
- `Game Speed` (world speed scalar)
- `Gravity` (units/sec² for jump)

## Implementation shape (recommended)
Keep game logic outside React render:
- React: mount a canvas + handle resize/unmount.
- Three/game: `Game` class/module that owns scene/camera/renderer, update loop, and disposals.
- Subsystems: `CharacterController`, `FloorSystem`, `ObstaclePool`, `Input`, `CollisionSystem`, `DebugUI`.
