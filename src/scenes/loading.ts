import Phaser from "phaser";

export default class LoadingScene extends Phaser.Scene {
    private loadingBar?: Phaser.GameObjects.Graphics;
    private loadingBarBg?: Phaser.GameObjects.Graphics;
    private progressText?: Phaser.GameObjects.Text;

    constructor() {
        super({
            key: "LoadingScene"
        });
    }

    preload() {
        this.load.image("ship_enemy_1", "assets/ship_enemy_1.png");
        this.load.image("ship_player_1", "assets/ship_player_1.png");
        this.load.image("ship_player_1_highlight", "assets/ship_player_1_highlight.png");
        this.load.image("ship_player_2", "assets/ship_player_2.png");

        this.createLoadingScreen();
        this.setupLoadingEvents();
    }

    private createLoadingScreen(): void {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, height / 2 - 120, "SHIP FIGHT", {
            fontSize: "48px",
            color: "#ffffff",
            fontFamily: "Arial, sans-serif",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.progressText = this.add.text(width / 2, height / 2 + 50, "0%", {
            fontSize: "18px",
            color: "#ffffff",
            fontFamily: "Arial, sans-serif",
            fontStyle: "bold"
        }).setOrigin(0.5);

        this.loadingBarBg = this.add.graphics();
        this.loadingBarBg.fillStyle(0x222222);
        this.loadingBarBg.fillRect(width / 2 - 300, height / 2 + 10, 600, 20);
        this.loadingBarBg.lineStyle(2, 0x444444);
        this.loadingBarBg.strokeRect(width / 2 - 300, height / 2 + 10, 600, 20);

        this.loadingBar = this.add.graphics();
    }

    private setupLoadingEvents(): void {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.load.on("progress", (percent: number) => {
            if (this.loadingBar) {
                this.loadingBar.clear();
                this.loadingBar.fillStyle(0xfffffff);
                this.loadingBar.fillRect(
                    width / 2 - 298,
                    height / 2 + 12,
                    596 * percent,
                    16
                );

                this.loadingBar.lineStyle(1, 0xfffffff, 0.5);
                this.loadingBar.strokeRect(
                    width / 2 - 300,
                    height / 2 + 10,
                    596 * percent,
                    20
                );
            }

            if (this.progressText) {
                this.progressText.setText(`${Math.round(percent * 100)}%`);
            }
        });

        this.load.on("complete", () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);

            this.cameras.main.once("camerafadeoutcomplete", () => {
                this.scene.start("GameScene");
            });
        });
    }
    create() {
    }

    update() {
    }
}