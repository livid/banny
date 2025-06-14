import { Start } from "./scenes/Start.js";
import { CharacterSelection } from "./scenes/CharacterSelection.js";

const config = {
    type: Phaser.WEBGL,
    title: "Banny",
    description: "",
    parent: "game-container",
    width: 1280,
    height: 720,
    backgroundColor: "#000000",
    pixelArt: true,
    scene: [CharacterSelection, Start],
    input: {
        gamepad: true,
    },
    physics: {
        default: "arcade",
        arcade: {
            debug: true,
        },
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
};

new Phaser.Game(config);
