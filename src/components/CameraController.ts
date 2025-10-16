import Phaser from "phaser";

export default class CameraController {
    private scene: Phaser.Scene;
    private cam: Phaser.Cameras.Scene2D.Camera;
    private screenWidth: number;
    private screenHeight: number;

    private isPanning = false;
    private lastPointerX = 0;
    private lastPointerY = 0;

    private minZoom = 0.5;
    private maxZoom = 2.0;
    private wheelZoomStep = 0.1;

    constructor(scene: Phaser.Scene, screenWidth: number, screenHeight: number) {
        this.scene = scene;
        this.cam = scene.cameras.main;
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;

        this.scene.input.mouse?.disableContextMenu();

        this.setupZoom();
        this.setupPan();
        this.clamp();
    }

    private setupZoom() {
        this.scene.input.on('wheel', (_pointer: any, _over: any, _deltaX: number, _deltaY: number, _deltaZ: number) => {
            const deltaY = _deltaY as number;
            const factor = deltaY > 0 ? -this.wheelZoomStep : this.wheelZoomStep;
            const newZoom = Phaser.Math.Clamp(this.cam.zoom + factor, this.minZoom, this.maxZoom);
            this.cam.setZoom(newZoom);
            this.clamp();
        });
    }

    private setupPan() {
        const input = this.scene.input;

        input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const isPanButton = pointer.rightButtonDown();
            if (isPanButton) {
                this.isPanning = true;
                this.lastPointerX = pointer.x;
                this.lastPointerY = pointer.y;
            }
        });

        input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!this.isPanning) return;
            const dx = pointer.x - this.lastPointerX;
            const dy = pointer.y - this.lastPointerY;
            this.cam.scrollX -= dx / this.cam.zoom;
            this.cam.scrollY -= dy / this.cam.zoom;
            this.lastPointerX = pointer.x;
            this.lastPointerY = pointer.y;
            this.clamp();
        });

        input.on('pointerup', () => {
            this.isPanning = false;
        });
    }

    private clamp() {
        const worldWidth = this.screenWidth;
        const worldHeight = this.screenHeight;
        const viewW = this.cam.width / this.cam.zoom;
        const viewH = this.cam.height / this.cam.zoom;

        const minX = 0;
        const minY = 0;
        const maxX = Math.max(0, worldWidth - viewW);
        const maxY = Math.max(0, worldHeight - viewH);

        this.cam.scrollX = Phaser.Math.Clamp(this.cam.scrollX, minX, maxX);
        this.cam.scrollY = Phaser.Math.Clamp(this.cam.scrollY, minY, maxY);
    }
}
