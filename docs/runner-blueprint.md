# Infinite Runner Blueprint (Side-Scroller 3D)

This is a compact reference for building an infinite side-scrolling 3D runner with Three.js.

## Core constants
- Lanes on Z: `-5`, `0`, `5`
- Player X: fixed (world scrolls past the player)
- Side-scroller camera: look down Z, move along X
- Delta-time everywhere: `const delta = clock.getDelta()`

## Update loop (per frame)
1) Compute `delta`.
2) Update camera follow (damped).
3) Update parallax offsets (if running).
4) Update mixer.
5) Update player (lane lerp + jump physics).
6) Move floor segments and leapfrog behind segments to the front.
7) Move obstacles and recycle when missed.
8) Check collisions and transition to dead state.

## Systems you need
- `Game` root: owns scene, renderer, camera, update loop, resize, dispose.
- `CharacterController`: lane targeting, jump physics, AnimationMixer with Run/Jump/Death.
- `FloorSystem`: N segments, move by speed, wrap to front.
- `ObstaclePool`: preallocate, move, recycle, random lane assignment.
- `CollisionSystem`: simple Box3 overlap; gate when dead.
- `DebugUI`: lil-gui sliders for game speed and gravity.

## Rendering setup
- `renderer.outputColorSpace = SRGBColorSpace`
- `renderer.toneMapping = ACESFilmicToneMapping`
- Update animation and movement with delta-time for consistent motion.

## Asset pipeline
- Place models in `/public/models/`.
- Use `GLTFLoader` + `AnimationMixer`.
- Map animation clips to Run/Jump/Death; log clip names to pick the right ones.
- Background layers in `/public/backgrounds/` with parallax offsets.

## Camera baseline (side scroller)
- Orthographic or perspective camera is fine.
- Set camera X to follow the player with a lead.
- Keep player at fixed X; move world toward negative X.

## Collision gate
- On collision: play Death, stop input, stop world movement.
- Freeze floor/obstacles but keep mixer ticking if needed.

## Tuning checklist
- Jump: impulse, gravity, max height, airtime.
- Spawn spacing: obstacle gap range and count.
- Speed: readable at low speeds, exciting at high speeds.
- Camera: view height, lead, look-at Y.
- Parallax: layer depths, speed ratios, repeat count.

## Gotchas
- Keep depth testing on for background layers so the player renders in front.
- Pool obstacles; avoid creating new meshes each frame.
- Reset `clock.getDelta()` on state transitions to avoid large spikes.
