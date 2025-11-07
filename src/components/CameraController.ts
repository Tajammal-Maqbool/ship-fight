import Phaser from "phaser";
import * as dat from 'dat.gui';

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

    private followTarget: Phaser.GameObjects.Sprite | null = null;
    private followEnabled: boolean = true;
    private followLerpFactor: number = 0.1;
    private gui: dat.GUI | null = null;

    constructor(scene: Phaser.Scene, screenWidth: number, screenHeight: number) {
        this.scene = scene;
        this.cam = scene.cameras.main;
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;

        this.scene.input.mouse?.disableContextMenu();

        this.setupZoom();
        this.setupPan();
        this.clamp();
        this.createGUI();
    }

    public setFollowTarget(target: Phaser.GameObjects.Sprite | null): void {
        this.followTarget = target;
    }

    public update(): void {
        if (this.followEnabled && this.followTarget && !this.isPanning) {
            const targetX = this.followTarget.x - this.cam.width / (2 * this.cam.zoom);
            const targetY = this.followTarget.y - this.cam.height / (2 * this.cam.zoom);
            
            this.cam.scrollX += (targetX - this.cam.scrollX) * this.followLerpFactor;
            this.cam.scrollY += (targetY - this.cam.scrollY) * this.followLerpFactor;
            
            this.clamp();
        }
    }

    public getDebugInfo(): string {
        return `Follow: ${this.followEnabled}, Target: ${this.followTarget ? 'SET' : 'NULL'}, Panning: ${this.isPanning}`;
    }

    private createGUI(): void {
        this.gui = new dat.GUI({ name: 'Camera Controls' });
        
        const cameraFolder = this.gui.addFolder('Camera Follow');
        cameraFolder.add(this as any, 'followEnabled').name('Follow Selected Ship');
        cameraFolder.add(this as any, 'followLerpFactor', 0.01, 1.0, 0.01).name('Follow Smoothness');
        cameraFolder.open();

        const zoomFolder = this.gui.addFolder('Zoom Settings');
        zoomFolder.add(this as any, 'minZoom', 0.1, 1.0, 0.1).name('Min Zoom');
        zoomFolder.add(this as any, 'maxZoom', 1.0, 5.0, 0.1).name('Max Zoom');
        zoomFolder.add(this as any, 'wheelZoomStep', 0.05, 0.5, 0.05).name('Zoom Step');
        zoomFolder.open();

        const debugFolder = this.gui.addFolder('Debug Info');
        const debugInfo = {
            status: 'Waiting...',
            targetSet: 'No',
            cameraX: '0',
            cameraY: '0'
        };

        const updateDebug = () => {
            debugInfo.status = this.followEnabled ? 'Enabled' : 'Disabled';
            debugInfo.targetSet = this.followTarget ? 'Yes' : 'No';
            debugInfo.cameraX = this.cam.scrollX.toFixed(1);
            debugInfo.cameraY = this.cam.scrollY.toFixed(1);
        };

        this.scene.events.on('update', updateDebug);

        debugFolder.add(debugInfo, 'status').listen().name('Follow Status');
        debugFolder.add(debugInfo, 'targetSet').listen().name('Target Set');
        debugFolder.add(debugInfo, 'cameraX').listen().name('Camera X');
        debugFolder.add(debugInfo, 'cameraY').listen().name('Camera Y');
        debugFolder.open();
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
            if (this.followEnabled) return;
            
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
