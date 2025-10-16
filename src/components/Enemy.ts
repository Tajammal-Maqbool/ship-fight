import Phaser from "phaser";

export default class Enemy extends Phaser.GameObjects.Sprite {
    private speed: number;
    private targetX: number;
    private targetY: number;
    private screenWidth: number;
    private screenHeight: number;
    private arrow?: Phaser.GameObjects.Graphics;
    private isMoving: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number, speed: number, screenWidth: number, screenHeight: number) {
        super(scene, x, y, "ship_enemy_1");

        this.speed = speed;
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.targetX = x;
        this.targetY = y;

        scene.add.existing(this);

        this.setOrigin(0.5, 0.5);
        this.createArrow();
        this.chooseNewTarget();
    }

    private createArrow(): void {
        this.arrow = this.scene.add.graphics();
        this.arrow.setDepth(10);
    }

    private chooseNewTarget(): void {
        const margin = 50;
        this.targetX = Phaser.Math.Between(margin, this.screenWidth - margin);
        this.targetY = Phaser.Math.Between(margin, this.screenHeight - margin);
        this.isMoving = true;
    }

    private updateArrow(): void {
        if (!this.arrow || !this.isMoving) {
            this.arrow?.clear();
            return;
        }

        this.arrow.clear();

        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 5) return;

        const dirX = dx / distance;
        const dirY = dy / distance;
        const arrowLength = 40;
        const arrowHeadSize = 8;
        const offsetFromShip = 30;
        const startX = this.x + dirX * offsetFromShip;
        const startY = this.y + dirY * offsetFromShip;
        const endX = startX + dirX * arrowLength;
        const endY = startY + dirY * arrowLength;

        this.arrow.lineStyle(3, 0xff0000, 0.8);
        this.arrow.lineBetween(startX, startY, endX, endY);
        this.arrow.fillStyle(0xff0000, 0.8);
        this.arrow.beginPath();
        this.arrow.moveTo(endX, endY);
        this.arrow.lineTo(
            endX - arrowHeadSize * dirX + arrowHeadSize * 0.5 * dirY,
            endY - arrowHeadSize * dirY - arrowHeadSize * 0.5 * dirX
        );
        this.arrow.lineTo(
            endX - arrowHeadSize * dirX - arrowHeadSize * 0.5 * dirY,
            endY - arrowHeadSize * dirY + arrowHeadSize * 0.5 * dirX
        );
        this.arrow.closePath();
        this.arrow.fillPath();
    }

    public update(): void {
        if (!this.isMoving) return;

        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 5) {
            this.isMoving = false;
            this.scene.time.delayedCall(1000 + Math.random() * 2000, () => {
                this.chooseNewTarget();
            });
            this.arrow?.clear();
            return;
        }

        const dirX = dx / distance;
        const dirY = dy / distance;

        this.x += dirX * this.speed;
        this.y += dirY * this.speed;

        this.rotation = Math.atan2(dirY, dirX) + Math.PI / 2;

        this.updateArrow();
    }

    public destroy(): void {
        if (this.arrow) {
            this.arrow.destroy();
        }
        super.destroy();
    }
}
