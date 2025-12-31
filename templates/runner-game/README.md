# Infinite Runner Template

Reusable Three.js runner core (Vite + React + TypeScript). Copy this folder into a new project and wire it up.

## Copy
1) Copy `templates/runner-game/src/game` into your project `src/game`.
2) Ensure these dependencies are installed:
   - `npm install three lil-gui`
3) Put `.gltf` or `.glb` models in `/public/models/` and update `src/game/assetPaths.ts`.
4) Put background layers in `/public/backgrounds/` or edit the layer list in `src/game/Game.ts`.

## Minimal App Hookup
Add a container in your React app and boot the game on mount:

```tsx
import { useEffect, useRef } from "react";
import { Game } from "./game/Game";

export function App() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const game = new Game(hostRef.current);
    return () => game.dispose();
  }, []);

  return <div ref={hostRef} style={{ width: "100vw", height: "100vh" }} />;
}
```

## Notes
- Lanes are `-5/0/5` on Z with side-scroller camera looking down Z.
- All movement and AnimationMixer updates use `clock.getDelta()` for frame-rate independence.
- Renderer uses `SRGBColorSpace` + `ACESFilmicToneMapping`.
- Debug sliders live in `Game.ts` via `lil-gui` (game speed + gravity).
