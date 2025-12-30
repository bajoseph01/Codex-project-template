# HANDOFF (2025-12-30 -- Africa/Johannesburg)

## Goal
Have a working learning-focused infinite runner running locally with Chicken as player and Cat as obstacles, using Three.js + glTF assets.

## Current state (facts only)
- Repo: `c:\Users\bajos\OneDrive\@_2025_Coding\Infinite Runner`
- Codex skill installed: `C:\Users\bajos\.codex\skills\infinite-runner-threejs\SKILL.md`
- Packaged skill file: `dist/infinite-runner-threejs.skill`
- Three.js reference notes: `docs/threejs-notes.md`
- Vite + React + TS app scaffolded at repo root (`package.json`, `src/`, `vite.config.ts`)
- Game code: `src/game/Game.ts`
- Models used:
  - Player: `/public/models/Ultimate Monsters/Blob/glTF/Chicken.gltf`
  - Obstacle: `/public/models/Ultimate Monsters/Blob/glTF/Cat.gltf`
- Key constraints: Three.js core; delta-time updates; SRGB + ACES; assets from `/public/models`; 3 lanes (-5/0/5); infinite floor; obstacle pooling; AnimationMixer animations; lil-gui debug (speed, gravity)

## Decisions (locked)
- D1: Use a dedicated Codex skill named `infinite-runner-threejs` for runner build workflow.
- D2: Keep general Three.js guidance as project docs (not as a skill).
- D3: Keep models as `.gltf` (no conversion to `.glb` for now).
- D4: Use Chicken as player and Cat as obstacles.

## Open questions (need answers)
1) Which animation clips should map to Run / Jump / Death for the Chicken model (it has different clip names)?
2) Do you want touch controls later (mobile), or keyboard-only?

## Next 3 tasks (ordered)
1) Rename/choose animation clips for Chicken to behave like Run/Jump/Death (or add a simple mapping UI).
2) Improve collision performance (reuse Box3 objects) and tune gameplay feel (jump height, spacing).
3) Add a simple on-screen HUD (score + “Press Space to jump”).

## Commands to run (exact)
- `npm install`
- `npm run dev`
- `npm run build`

## Files touched (most important)
- `skills/public/infinite-runner-threejs/SKILL.md`
- `docs/threejs-notes.md`
- `HANDOFF.md`
- `src/game/Game.ts`
- `AGENTS.md`
