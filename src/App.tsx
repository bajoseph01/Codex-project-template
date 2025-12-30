import { useEffect, useRef } from "react";
import { Game } from "./game/Game";
import "./App.css";

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const game = new Game(mount);
    return () => game.dispose();
  }, []);

  return <div className="gameRoot" ref={mountRef} />;
}

export default App;
