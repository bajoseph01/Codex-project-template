# Three.js Notes (Project Reference)

This file is plain project documentation (not a Codex skill).

## Mental model (scene graph)
- Three.js renders whatever is in `scene`.
- Objects can be parented (use `Group`) so transforms (position/rotation/scale) affect children.

## Baseline setup (ES modules)
Use the installed `three` package (recommended for Vite).

```ts
import * as THREE from "three";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Color management defaults we want for this project
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  // update(delta)
  renderer.render(scene, camera);
});
```

Resize handler:
```ts
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
```

## Common building blocks

Geometries:
- `BoxGeometry` (boxes)
- `PlaneGeometry` (floors/walls)
- `SphereGeometry` (spheres)
- `CylinderGeometry` / `ConeGeometry` (tubes/spikes)

Materials:
- `MeshStandardMaterial` (default PBR, uses lights)
- `MeshBasicMaterial` (unlit, ignores lights)
- `MeshNormalMaterial` (debug normals)

Lighting (typical start):
- `AmbientLight` at low intensity (0.3-0.5)
- `DirectionalLight` as a main light

## Animation
- Prefer `renderer.setAnimationLoop(...)` over manual `requestAnimationFrame`.
- For GLB character clips, use `AnimationMixer` and call `mixer.update(delta)` every frame.

## Imports you should use (modern Three.js)
OrbitControls:
```ts
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
```

GLTFLoader:
```ts
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
```

## Easy mistakes (avoid)
- Forgetting `scene.add(mesh)` (nothing renders).
- Creating new geometries/materials inside the animation loop (slow + memory churn).
- Not capping pixel ratio (kills performance on high-DPI screens): `Math.min(devicePixelRatio, 2)`.

