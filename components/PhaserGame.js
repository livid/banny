import { useEffect } from 'react';
import createGame from '../src/game.js';

export default function PhaserGame() {
  useEffect(() => {
    const game = createGame();
    return () => {
      if (game) {
        game.destroy(true);
      }
    };
  }, []);

  return <div id="game-container" />;
}
