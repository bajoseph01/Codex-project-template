import { useEffect, useRef, useState } from "react";
import { Game, type GameState } from "./game/Game";
import "./App.css";

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [gameState, setGameState] = useState<GameState>("loading");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const game = new Game(mount, { onStateChange: setGameState });
    gameRef.current = game;
    return () => {
      gameRef.current = null;
      game.dispose();
    };
  }, []);

  return (
    <div className="gameRoot" ref={mountRef}>
      {gameState === "dead" && (
        <button
          className="restartButton"
          onClick={() => gameRef.current?.restart()}
          type="button"
        >
          Restart
        </button>
      )}
    </div>
  );
}

export default App;
