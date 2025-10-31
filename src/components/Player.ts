import Phaser from "phaser";
import * as dat from 'dat.gui';

interface ClickPoint {
    x: number;
    y: number;
    graphics: Phaser.GameObjects.Graphics;
}

interface DragDirection {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    directionX: number;
    directionY: number;
    graphics: Phaser.GameObjects.Graphics;
}

type MovementCommand =
    | { kind: 'point'; x: number; y: number; graphics: Phaser.GameObjects.Graphics }
    | { kind: 'direction'; startX: number; startY: number; endX: number; endY: number; directionX: number; directionY: number; graphics: Phaser.GameObjects.Graphics };

export default class Player extends Phaser.GameObjects.Sprite {
    private static selectedPlayer: Player | null = null;
    private static gameScene: Phaser.Scene | null = null;
    private static gui: dat.GUI | null = null;
    
    private moveSpeed: number = 3;
    private screenWidth: number;
    private screenHeight: number;
    private color: number;

    private shipArrow?: Phaser.GameObjects.Graphics;
    private highlightSprite?: Phaser.GameObjects.Sprite;

    private controlMode: 'mouse' | 'keyboard' = 'mouse';

    private velocityX: number = 0;
    private velocityY: number = 0;
    private angularVelocity: number = 0;
    
    private THRUST_POWER = 0.05;
    private ROTATION_POWER = 0.003;
    private MAX_SPEED = 6;
    private MAX_ROTATION_SPEED = 0.08;
    private ROTATION_DAMPING = 0.92;

    private keysPressed: Set<string> = new Set();
    private keyboardEnabled: boolean = false;

    private movementMode: 'idle' | 'moving-to-point' | 'moving-with-direction' = 'idle';
    private targetX: number;
    private targetY: number;
    private targetRotation: number = 0;
    private currentClickPoint: ClickPoint | null = null;
    private currentDragDirection: DragDirection | null = null;
    private previewDirection: DragDirection | null = null;

    private isDragMode: boolean = false;
    private dragStartPoint: { x: number; y: number } | null = null;
    private initialDistance: number = 0;
    private initialRotation: number = 0;
    private worldInteractionStarted: boolean = false;
    private movedDuringDrag: boolean = false;

    private commandQueue: MovementCommand[] = [];
    private activeCommand: MovementCommand | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, screenWidth: number, screenHeight: number, color: number = 0x00ff88) {
        super(scene, x, y, "ship_player_1");

        this.targetX = x;
        this.targetY = y;
        this.targetRotation = 0;
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.color = color;

        if (!Player.gameScene) {
            Player.gameScene = scene;
            this.setupGlobalInputHandlers();
        }

        scene.add.existing(this);
        this.setOrigin(0.5, 0.5);
        this.setInteractive();

        this.createVisuals();
        this.setupShipInputHandlers();
        this.setupKeyboardHandlers();
    }

    private setupGlobalInputHandlers(): void {
        if (!Player.gameScene) return;

        Player.gameScene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!Player.selectedPlayer) return;
            if (Player.selectedPlayer.controlMode === 'keyboard') return;

            const hitObjects = Player.gameScene!.input.hitTestPointer(pointer);
            const clickedOnShip = hitObjects.some(obj => obj instanceof Player);

            if (!clickedOnShip) {
                if (!pointer.leftButtonDown()) return;
                Player.selectedPlayer.dragStartPoint = { x: pointer.worldX, y: pointer.worldY };
                Player.selectedPlayer.worldInteractionStarted = true;
                Player.selectedPlayer.movedDuringDrag = false;
            }
        });

        Player.gameScene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!Player.selectedPlayer) return;
            if (Player.selectedPlayer.controlMode === 'keyboard') return;
            if (!pointer.isDown) return;
            if (!Player.selectedPlayer.worldInteractionStarted || !Player.selectedPlayer.dragStartPoint) return;

            Player.selectedPlayer.movedDuringDrag = true;
            Player.selectedPlayer.handleWorldDrag(pointer);
        });

        Player.gameScene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (!Player.selectedPlayer) return;
            if (Player.selectedPlayer.controlMode === 'keyboard') return; // Ignore mouse input in keyboard mode
            if (pointer.rightButtonReleased()) return;
            Player.selectedPlayer.handleWorldPointerUp(pointer);
        });
    }

    private setupShipInputHandlers(): void {
        this.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();

            if (Player.selectedPlayer && Player.selectedPlayer !== this) {
                Player.selectedPlayer.deselect();
                Player.selectedPlayer.isDragMode = false;
            }

            this.select();
            this.worldInteractionStarted = false;
            this.movedDuringDrag = false;
            this.dragStartPoint = null;
            this.isDragMode = false;
        });
    }

    private setupKeyboardHandlers(): void {
        this.scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (Player.selectedPlayer !== this || !this.keyboardEnabled) return;

            const key = event.key.toUpperCase();
            if (['W', 'A', 'S', 'D', 'Q', 'E'].includes(key)) {
                this.keysPressed.add(key);
                event.preventDefault();
            }
        });

        this.scene.input.keyboard?.on('keyup', (event: KeyboardEvent) => {
            if (Player.selectedPlayer !== this || !this.keyboardEnabled) return;

            const key = event.key.toUpperCase();
            this.keysPressed.delete(key);
        });

        this.scene.input.keyboard?.on('keydown-T', () => {
            if (Player.selectedPlayer !== this) return;

            this.controlMode = this.controlMode === 'mouse' ? 'keyboard' : 'mouse';
            this.keyboardEnabled = this.controlMode === 'keyboard';
            
            if (this.controlMode === 'keyboard') {
                this.clearCurrentMovement();
                this.clearCommandQueue();
                this.velocityX = 0;
                this.velocityY = 0;
                this.angularVelocity = 0;
                this.keysPressed.clear();
                console.log('Control mode: KEYBOARD - All movement points cleared');
            } else {
                console.log('Control mode: MOUSE');
            }
        });
    }

    private createVisuals(): void {
        this.shipArrow = this.scene.add.graphics();
        this.shipArrow.setDepth(10);

        this.highlightSprite = this.scene.add.sprite(this.x, this.y, "ship_player_1_highlight");
        this.highlightSprite.setOrigin(0.5, 0.5);
        this.highlightSprite.setDepth(-1);
        this.highlightSprite.setVisible(false);
    }

    private select(): void {
        Player.selectedPlayer = this;
        if (this.highlightSprite) {
            this.highlightSprite.setVisible(true);
        }
        this.createDebugGUI();
    }

    private deselect(): void {
        this.isDragMode = false;
        this.worldInteractionStarted = false;
        this.movedDuringDrag = false;
        this.dragStartPoint = null;
        if (this.previewDirection) {
            this.previewDirection.graphics.destroy();
            this.previewDirection = null;
        }
        if (this.highlightSprite) {
            this.highlightSprite.setVisible(false);
        }
        this.updateShipArrow();
        this.destroyDebugGUI();
    }

    private createDebugGUI(): void {
        this.destroyDebugGUI();

        Player.gui = new dat.GUI({ name: 'Player Controls' });
        
        const movementFolder = Player.gui.addFolder('Mouse Mode Controls');
        movementFolder.add(this as any, 'moveSpeed', 0.5, 10, 0.1).name('Move Speed');
        movementFolder.open();
        
        const physicsFolder = Player.gui.addFolder('Keyboard Mode Controls');
        physicsFolder.add(this as any, 'THRUST_POWER', 0.01, 0.2, 0.005).name('Thrust Power');
        physicsFolder.add(this as any, 'ROTATION_POWER', 0.001, 0.01, 0.0001).name('Rotation Power');
        physicsFolder.add(this as any, 'MAX_SPEED', 1, 15, 0.5).name('Max Speed');
        physicsFolder.add(this as any, 'MAX_ROTATION_SPEED', 0.01, 0.2, 0.01).name('Max Rotation Speed');
        physicsFolder.add(this as any, 'ROTATION_DAMPING', 0.8, 0.99, 0.01).name('Rotation Damping');
        physicsFolder.open();
        
        const stateFolder = Player.gui.addFolder('Current State');
        const state = {
            velocityX: this.velocityX.toFixed(2),
            velocityY: this.velocityY.toFixed(2),
            angularVelocity: this.angularVelocity.toFixed(4),
            rotation: (this.rotation * 180 / Math.PI).toFixed(1) + '°',
            controlMode: this.controlMode,
            movementMode: this.movementMode
        };
        
        const updateState = () => {
            state.velocityX = this.velocityX.toFixed(2);
            state.velocityY = this.velocityY.toFixed(2);
            state.angularVelocity = this.angularVelocity.toFixed(4);
            state.rotation = (this.rotation * 180 / Math.PI).toFixed(1) + '°';
            state.controlMode = this.controlMode;
            state.movementMode = this.movementMode;
        };
        
        this.scene.events.on('update', updateState);
        
        stateFolder.add(state, 'velocityX').listen().name('Velocity X');
        stateFolder.add(state, 'velocityY').listen().name('Velocity Y');
        stateFolder.add(state, 'angularVelocity').listen().name('Angular Velocity');
        stateFolder.add(state, 'rotation').listen().name('Rotation');
        stateFolder.add(state, 'controlMode').listen().name('Control Mode');
        stateFolder.add(state, 'movementMode').listen().name('Movement Mode');
        stateFolder.open();
        
        const actions = {
            resetVelocity: () => {
                this.velocityX = 0;
                this.velocityY = 0;
                this.angularVelocity = 0;
            },
            resetPhysics: () => {
                this.THRUST_POWER = 0.05;
                this.ROTATION_POWER = 0.003;
                this.MAX_SPEED = 6;
                this.MAX_ROTATION_SPEED = 0.08;
                this.ROTATION_DAMPING = 0.92;
                this.moveSpeed = 3;

                this.destroyDebugGUI();
                this.createDebugGUI();
            }
        };
        
        Player.gui.add(actions, 'resetVelocity').name('Reset Velocity');
        Player.gui.add(actions, 'resetPhysics').name('Reset Controls to Defaults');
    }

    private destroyDebugGUI(): void {
        if (Player.gui) {
            Player.gui.destroy();
            Player.gui = null;
        }
    }

    private clearCurrentMovement(): void {
        this.movementMode = 'idle';
        if (this.currentDragDirection) {
            this.currentDragDirection.graphics.destroy();
            this.currentDragDirection = null;
        }
        if (this.activeCommand && this.activeCommand.kind === 'point') {
            this.activeCommand.graphics.destroy();
        } else if (this.activeCommand && this.activeCommand.kind === 'direction') {
            this.activeCommand.graphics.destroy();
        }
        this.activeCommand = null;
    }

    private clearCommandQueue(): void {
        for (const command of this.commandQueue) {
            if (command.graphics) {
                command.graphics.destroy();
            }
        }
        this.commandQueue = [];
    }

    private handleWorldDrag(pointer: Phaser.Input.Pointer): void {
        if (!this.worldInteractionStarted || !this.dragStartPoint) return;

        if (!this.previewDirection) {
            this.previewDirection = {
                startX: this.dragStartPoint.x,
                startY: this.dragStartPoint.y,
                endX: this.dragStartPoint.x,
                endY: this.dragStartPoint.y,
                directionX: 0,
                directionY: -1,
                graphics: this.scene.add.graphics()
            };
        }
        this.updatePreviewDirection(this.dragStartPoint.x, this.dragStartPoint.y, pointer.worldX, pointer.worldY);
    }

    private handleWorldPointerUp(pointer: Phaser.Input.Pointer): void {
        if (this.dragStartPoint && this.worldInteractionStarted) {
            const dx = pointer.worldX - this.dragStartPoint.x;
            const dy = pointer.worldY - this.dragStartPoint.y;
            const dragDistance = Math.sqrt(dx * dx + dy * dy);

            if (this.movedDuringDrag && dragDistance > 20 && this.previewDirection) { // threshold 20
                const dir = this.previewDirection;
                const command: MovementCommand = {
                    kind: 'direction',
                    startX: dir.startX, startY: dir.startY, endX: dir.endX, endY: dir.endY,
                    directionX: dir.directionX, directionY: dir.directionY,
                    graphics: dir.graphics
                };
                this.commandQueue.push(command);
                this.previewDirection = null;
            } else {
                this.enqueuePoint(this.dragStartPoint.x, this.dragStartPoint.y);
                if (this.previewDirection) {
                    this.previewDirection.graphics.destroy();
                    this.previewDirection = null;
                }
            }

            this.dragStartPoint = null;
            this.isDragMode = false;
            this.worldInteractionStarted = false;
            this.movedDuringDrag = false;
            if (this.movementMode === 'idle' && !this.activeCommand) {
                this.processNextCommand();
            }
        } else if (!this.isDragMode && this.currentClickPoint) {
            this.movementMode = 'moving-to-point';
        }
    }

    private enqueuePoint(x: number, y: number): void {
        const graphics = this.scene.add.graphics();
        this.renderClickMarker(graphics, x, y);
        const cmd: MovementCommand = { kind: 'point', x, y, graphics };
        this.commandQueue.push(cmd);
        
    }

    private processNextCommand(): void {
        if (this.activeCommand || this.commandQueue.length === 0) return;
        this.activeCommand = this.commandQueue.shift()!;
        if (this.activeCommand.kind === 'point') {
            this.targetX = this.activeCommand.x;
            this.targetY = this.activeCommand.y;
            this.movementMode = 'moving-to-point';
        } else {
            this.targetX = this.activeCommand.startX;
            this.targetY = this.activeCommand.startY;
            const shipDx = this.targetX - this.x;
            const shipDy = this.targetY - this.y;
            this.initialDistance = Math.sqrt(shipDx * shipDx + shipDy * shipDy);
            this.initialRotation = this.rotation;
            this.movementMode = 'moving-with-direction';
        }
    }

    private renderClickMarker(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
        graphics.clear();
        graphics.setDepth(5);
        graphics.fillStyle(this.color, 0.8);
        graphics.fillCircle(x, y, 8);
        graphics.lineStyle(2, this.color, 1);
        graphics.strokeCircle(x, y, 15);
        graphics.lineBetween(x - 10, y, x + 10, y);
        graphics.lineBetween(x, y - 10, x, y + 10);
    }

    private updatePreviewDirection(pointX: number, pointY: number, mouseX: number, mouseY: number): void {
        if (!this.previewDirection) return;

        const dx = mouseX - pointX;
        const dy = mouseY - pointY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        this.previewDirection.startX = pointX;
        this.previewDirection.startY = pointY;
        this.previewDirection.endX = mouseX;
        this.previewDirection.endY = mouseY;

        if (distance > 10) {
            this.previewDirection.directionX = dx / distance;
            this.previewDirection.directionY = dy / distance;
        } else {
            this.previewDirection.directionX = 0;
            this.previewDirection.directionY = -1;
        }

        this.updatePreviewDirectionVisual();
    }

    private updateShipArrow(): void {
        if (!this.shipArrow) return;

        this.shipArrow.clear();

        if (this.controlMode === 'keyboard') {
            // In keyboard mode, show velocity direction if moving
            const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
            if (speed > 0.5) {
                const dirX = this.velocityX / speed;
                const dirY = this.velocityY / speed;
                this.drawShipDirectionArrow(dirX, dirY, 0x00ffff, 40);
            }
        } else if (this.movementMode === 'idle') {
            this.drawShipDirectionArrow(0, -1, this.color, 30);
        } else if (this.movementMode === 'moving-to-point' || this.movementMode === 'moving-with-direction') {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
                this.drawShipDirectionArrow(dx / distance, dy / distance, this.color, 40);
            }
        }
    }

    private drawShipDirectionArrow(dirX: number, dirY: number, color: number, length: number): void {
        if (!this.shipArrow) return;

        const offset = 30;
        const arrowHeadSize = 8;

        const startX = this.x + dirX * offset;
        const startY = this.y + dirY * offset;
        const endX = startX + dirX * length;
        const endY = startY + dirY * length;

        this.shipArrow.lineStyle(3, color, 0.8);
        this.shipArrow.lineBetween(startX, startY, endX, endY);
        this.shipArrow.fillStyle(color, 0.8);
        this.shipArrow.beginPath();
        this.shipArrow.moveTo(endX, endY);
        this.shipArrow.lineTo(
            endX - arrowHeadSize * dirX + arrowHeadSize * 0.5 * dirY,
            endY - arrowHeadSize * dirY - arrowHeadSize * 0.5 * dirX
        );
        this.shipArrow.lineTo(
            endX - arrowHeadSize * dirX - arrowHeadSize * 0.5 * dirY,
            endY - arrowHeadSize * dirY + arrowHeadSize * 0.5 * dirX
        );
        this.shipArrow.closePath();
        this.shipArrow.fillPath();
    }

    private updatePreviewDirectionVisual(): void {
        if (!this.previewDirection) return;

        const graphics = this.previewDirection.graphics;
        graphics.clear();
        graphics.setDepth(5);

        const { startX, startY, endX, endY, directionX, directionY } = this.previewDirection;

    graphics.fillStyle(this.color, 0.8);
        graphics.fillCircle(startX, startY, 8);
    graphics.lineStyle(2, this.color, 1);
        graphics.strokeCircle(startX, startY, 15);

        graphics.lineBetween(startX - 10, startY, startX + 10, startY);
        graphics.lineBetween(startX, startY - 10, startX, startY + 10);

        const distance = Math.sqrt((endX - startX) * (endX - startX) + (endY - startY) * (endY - startY));

        if (distance > 5) {
            graphics.lineStyle(3, this.color, 0.8);
            graphics.lineBetween(startX, startY, endX, endY);

            const arrowHeadSize = 12;
            graphics.fillStyle(this.color, 0.8);
            graphics.beginPath();
            graphics.moveTo(endX, endY);
            graphics.lineTo(
                endX - arrowHeadSize * directionX + arrowHeadSize * 0.5 * directionY,
                endY - arrowHeadSize * directionY - arrowHeadSize * 0.5 * directionX
            );
            graphics.lineTo(
                endX - arrowHeadSize * directionX - arrowHeadSize * 0.5 * directionY,
                endY - arrowHeadSize * directionY + arrowHeadSize * 0.5 * directionX
            );
            graphics.closePath();
            graphics.fillPath();
        }
    }

    private updateKeyboardPhysics(): void {
        // Apply rotation
        if (this.keysPressed.has('A')) {
            this.angularVelocity -= this.ROTATION_POWER;
        }
        if (this.keysPressed.has('D')) {
            this.angularVelocity += this.ROTATION_POWER;
        }

        // Apply rotational damping when no rotation keys pressed
        if (!this.keysPressed.has('A') && !this.keysPressed.has('D')) {
            this.angularVelocity *= this.ROTATION_DAMPING;
            if (Math.abs(this.angularVelocity) < 0.0001) {
                this.angularVelocity = 0;
            }
        }

        // Clamp rotation speed
        this.angularVelocity = Phaser.Math.Clamp(
            this.angularVelocity,
            -this.MAX_ROTATION_SPEED,
            this.MAX_ROTATION_SPEED
        );

        // Apply rotation to ship
        this.rotation += this.angularVelocity;

        // Calculate thrust direction based on ship rotation
        const shipAngle = this.rotation - Math.PI / 2; // -90 degrees because ship points up by default
        const forwardX = Math.cos(shipAngle);
        const forwardY = Math.sin(shipAngle);
        const rightX = Math.cos(shipAngle + Math.PI / 2);
        const rightY = Math.sin(shipAngle + Math.PI / 2);

        // Apply thrust based on keys and update highlight sprite
        const isForwardThrust = this.keysPressed.has('W');
        const isBackwardThrust = this.keysPressed.has('S');
        
        if (isForwardThrust) {
            this.velocityX += forwardX * this.THRUST_POWER;
            this.velocityY += forwardY * this.THRUST_POWER;
            this.updateThrustVisual('forward');
        } else if (isBackwardThrust) {
            this.velocityX -= forwardX * this.THRUST_POWER;
            this.velocityY -= forwardY * this.THRUST_POWER;
            this.updateThrustVisual('backward');
        } else {
            this.updateThrustVisual('none');
        }
        
        if (this.keysPressed.has('Q')) {
            this.velocityX -= rightX * this.THRUST_POWER;
            this.velocityY -= rightY * this.THRUST_POWER;
        }
        if (this.keysPressed.has('E')) {
            this.velocityX += rightX * this.THRUST_POWER;
            this.velocityY += rightY * this.THRUST_POWER;
        }

        // Clamp to max speed
        const currentSpeed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
        if (currentSpeed > this.MAX_SPEED) {
            const scale = this.MAX_SPEED / currentSpeed;
            this.velocityX *= scale;
            this.velocityY *= scale;
        }

        // Apply velocity to position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Keep ship within bounds
        this.x = Phaser.Math.Clamp(this.x, 25, this.screenWidth - 25);
        this.y = Phaser.Math.Clamp(this.y, 25, this.screenHeight - 25);

        // Stop at edges (bounce effect)
        if (this.x <= 25 || this.x >= this.screenWidth - 25) {
            this.velocityX *= -0.5;
        }
        if (this.y <= 25 || this.y >= this.screenHeight - 25) {
            this.velocityY *= -0.5;
        }
    }

    private updateThrustVisual(thrustType: 'forward' | 'backward' | 'none'): void {
        if (!this.highlightSprite) return;

        if (thrustType === 'forward') {
            this.highlightSprite.setTexture('ship_player_1_thrusts_forward');
        } else if (thrustType === 'backward') {
            this.highlightSprite.setTexture('ship_player_1_thrusts_backward');
        } else {
            this.highlightSprite.setTexture('ship_player_1_highlight');
        }
    }

    public update(): void {
        if (this.controlMode === 'keyboard') {
            this.updateKeyboardPhysics();
            // In keyboard mode, target rotation follows actual rotation
            this.targetRotation = this.rotation;
        } else {
            // Mouse control mode
            if (this.movementMode === 'moving-to-point') {
                this.updatePointMovement();
            } else if (this.movementMode === 'moving-with-direction') {
                this.updateDirectionMovement();
            }

            this.rotation = this.approachRotation(this.rotation, this.targetRotation, 0.1);
        }

        if (this.highlightSprite) {
            this.highlightSprite.x = this.x;
            this.highlightSprite.y = this.y;
            this.highlightSprite.rotation = this.rotation;
        }

        this.updateShipArrow();
    }

    private updatePointMovement(): void {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 5) {
            this.movementMode = 'idle';
            this.isDragMode = false;
            if (this.activeCommand) {
                this.activeCommand.graphics.destroy();
                this.activeCommand = null;
            }
            this.processNextCommand();
        } else {
            const dirX = dx / distance;
            const dirY = dy / distance;
            this.x += dirX * this.moveSpeed;
            this.y += dirY * this.moveSpeed;
        }
    }

    private updateDirectionMovement(): void {
        if (!this.currentDragDirection) {
            if (this.activeCommand && this.activeCommand.kind === 'direction') {
                const cmd = this.activeCommand;
                this.currentDragDirection = {
                    startX: cmd.startX,
                    startY: cmd.startY,
                    endX: cmd.endX,
                    endY: cmd.endY,
                    directionX: cmd.directionX,
                    directionY: cmd.directionY,
                    graphics: cmd.graphics
                };
            } else {
                return;
            }
        }

        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const safeInitial = Math.max(1e-6, this.initialDistance);
        const traveledDistance = Phaser.Math.Clamp(safeInitial - distance, 0, safeInitial);
        const rotationProgress = Phaser.Math.Clamp(traveledDistance / safeInitial, 0, 1);

        const finalTargetRotation = Math.atan2(this.currentDragDirection.directionY, this.currentDragDirection.directionX) + Math.PI / 2;
        const delta = Phaser.Math.Angle.Wrap(finalTargetRotation - this.initialRotation);
        this.targetRotation = this.initialRotation + delta * rotationProgress;

        if (distance < 5) {
            this.movementMode = 'idle';
            if (this.currentDragDirection) {
                this.currentDragDirection.graphics.destroy();
                this.currentDragDirection = null;
            }
            this.isDragMode = false;
            if (this.activeCommand) {
                this.activeCommand = null;
            }
            this.processNextCommand();
        } else {
            const dirX = dx / distance;
            const dirY = dy / distance;

            this.x += dirX * this.moveSpeed;
            this.y += dirY * this.moveSpeed;

            this.x = Phaser.Math.Clamp(this.x, 25, this.screenWidth - 25);
            this.y = Phaser.Math.Clamp(this.y, 25, this.screenHeight - 25);
        }
    }

    private approachRotation(current: number, target: number, maxDelta: number): number {
        let diff = target - current;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;

        if (Math.abs(diff) <= maxDelta) return target;
        return current + Math.sign(diff) * maxDelta;
    }

    public destroy(): void {
        if (this.shipArrow) {
            this.shipArrow.destroy();
        }

        if (this.highlightSprite) {
            this.highlightSprite.destroy();
        }

        this.clearCurrentMovement();

        if (Player.selectedPlayer === this) {
            this.destroyDebugGUI();
            Player.selectedPlayer = null;
        }

        super.destroy();
    }
}
