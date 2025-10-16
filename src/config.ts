import Phaser from "phaser";
import GameScene from "./scenes/game.ts";
import LoadingScene from "./scenes/loading.ts";

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [LoadingScene, GameScene]
}

export default config;