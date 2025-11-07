import Phaser from "phaser";
import Player from "../components/Player";
import Enemy from "../components/Enemy";
import CameraController from "../components/CameraController";

export default class GameScene extends Phaser.Scene {
    private players: Player[] = [];
    private enemies: Enemy[] = [];
    private readonly SCREEN_WIDTH = 3000;
    private readonly SCREEN_HEIGHT = 3000;
    private uiCam!: Phaser.Cameras.Scene2D.Camera;
    private uiIgnored = new Set<Phaser.GameObjects.GameObject>();
    private mainIgnored = new Set<Phaser.GameObjects.GameObject>();
    private cameraController!: CameraController;
    private rectangles: Phaser.GameObjects.Rectangle[] = [];

    constructor() {
        super({ key: "GameScene" });
    }

    preload() { }

    create() {
        this.cameras.main.setBounds(0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);

        this.createRandomRectangles();
        this.createPlayers();
        this.createEnemies();

        this.cameraController = new CameraController(this, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);
        Player.setCameraController(this.cameraController);

        const controlsText = this.add
            .text(10, 10, 'MOUSE MODE (Press T to toggle)\nLeft Click to Select\nLeft Click/Drag to add points\nRight Click + Drag to Pan\nMouse Wheel to Zoom\n\nKEYBOARD MODE:\nW=Forward, S=Backward\nA=Rotate Left, D=Rotate Right\nQ=Strafe Left, E=Strafe Right', {
                font: '14px Arial',
                padding: { x: 10, y: 5 },
                color: '#ffffff',
                backgroundColor: '#333333'
            })
            .setScrollFactor(0)
            .setDepth(1000);
        controlsText.setData('ui', true);

        const mainCam = this.cameras.main;
        this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.uiCam.setZoom(1);
        this.uiCam.setScroll(0, 0);

        mainCam.ignore(controlsText);
        this.mainIgnored.add(controlsText);

        this.children.list.forEach(child => {
            const go = child as Phaser.GameObjects.GameObject;
            const isUI = (go as any).getData && (go as any).getData('ui') === true;
            if (!isUI) {
                this.uiCam.ignore(go);
                this.uiIgnored.add(go);
            }
        });

        this.scale.on('resize', (gameSize: { width: number; height: number }) => {
            this.uiCam.setSize(gameSize.width, gameSize.height);
        });
    }

    private createPlayers(): void {
        const player1 = new Player(
            this,
            this.SCREEN_WIDTH * 0.15,
            this.SCREEN_HEIGHT * 0.1,
            this.SCREEN_WIDTH,
            this.SCREEN_HEIGHT,
            0x00ff88
        );

        const player2 = new Player(
            this,
            this.SCREEN_WIDTH * 0.15,
            this.SCREEN_HEIGHT * 0.5,
            this.SCREEN_WIDTH,
            this.SCREEN_HEIGHT,
            0xff8800
        );

        this.players.push(player1, player2);

        player1.selectShip();
    }

    private createRandomRectangles(): void {
        const rectangleCount = 50;
        
        for (let i = 0; i < rectangleCount; i++) {
            const x = Phaser.Math.Between(50, this.SCREEN_WIDTH - 50);
            const y = Phaser.Math.Between(50, this.SCREEN_HEIGHT - 50);
            const width = Phaser.Math.Between(30, 150);
            const height = Phaser.Math.Between(30, 150);
            const colorHex = Phaser.Display.Color.RandomRGB().color;
            const alpha = Phaser.Math.FloatBetween(0.3, 0.9);
            const rectangle = this.add.rectangle(x, y, width, height, colorHex, alpha);
            this.rectangles.push(rectangle);
        }
    }

    private createEnemies(): void {
        for (let i = 0; i < 10; i++) {
            const enemy = new Enemy(
                this,
                Phaser.Math.Between(this.SCREEN_WIDTH * 0, this.SCREEN_WIDTH * 0.7),
                Phaser.Math.Between(50, this.SCREEN_HEIGHT - 50),
                0.5 + Math.random() * 1,
                this.SCREEN_WIDTH,
                this.SCREEN_HEIGHT
            );
            enemy.setDepth(0);
            this.enemies.push(enemy);
        }
    }

    update() {
        const list = this.children.list as Phaser.GameObjects.GameObject[];
        for (const obj of list) {
            const isUI = (obj as any).getData && (obj as any).getData('ui') === true;
            if (isUI) {
                if (!this.mainIgnored.has(obj)) {
                    this.cameras.main.ignore(obj);
                    this.mainIgnored.add(obj);
                }
            } else {
                if (!this.uiIgnored.has(obj)) {
                    this.uiCam.ignore(obj);
                    this.uiIgnored.add(obj);
                }
            }
        }

        this.cameraController.update();
        this.players.forEach(player => player.update());
        this.enemies.forEach(enemy => enemy.update());
    }
}