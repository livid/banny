import Phaser from 'phaser';
import { Start } from './scenes/Start.js';
import { CharacterSelection } from './scenes/CharacterSelection.js';
import { Victory } from './scenes/Victory.js';

export default function createGame(parentId = 'game-container') {
  const config = {
    type: Phaser.WEBGL,
    title: 'Banny',
    parent: parentId,
    width: 1280,
    height: 720,
    backgroundColor: '#000000',
    pixelArt: true,
    scene: [CharacterSelection, Start, Victory],
    input: {
      gamepad: true,
    },
    physics: {
      default: 'arcade',
      arcade: {
        debug: true,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  return new Phaser.Game(config);
}
