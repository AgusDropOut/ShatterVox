import { Camera } from "../core/Camera";
import { Input } from "./Input";
import { World } from "../world/World";
import { globalEventBus } from "./EventBus";
import { vec3, quat } from "gl-matrix";
import type { PhysicsFacade } from "../physics/PhysicsFacade";
import { VoxelRaycaster } from "../physics/VoxelRaycaster";
import type { SoundManager } from "../audio/SoundManager";
import type { BuildManager } from "./BuildManager";
import type { EntityRepository } from "../entity/EntityRepository";
import { ProjectRegistry } from "../entity/data/ProjectRegistry";

export class PlayerController {
    public readonly camera: Camera;
    public readonly input: Input;
    private readonly world: World;
    private readonly physicsFacade: PhysicsFacade;
    private readonly buildManager: BuildManager;
    private readonly entityRepo: EntityRepository;
    public readonly playerId: number;
    
    private walkSpeed: number = 2.8;
    private flySpeed: number = 8.0;
    
    private canThrowBomb: boolean = true;
    private canMine: boolean = true;
    private canBuild: boolean = true;
    private isBuildMode: boolean = false;
    
    public mineCooldownMs: number = 100; 
    public buildCooldownMs: number = 100; 
    public destructionRadius: number = 6;

    public targetPosition: vec3;
    public currentPlacementTarget: vec3 | null = null;
    public currentHitEntity: number | null = null; 
    public currentHitEntityInternalId: number | null = null;

    private draggedEntityId: number | null = null;
    private dragDistance: number = 0;

    private soundManager: SoundManager;
    private acousticTimer: number = 0;
    private readonly ACOUSTIC_INTERVAL: number = 0.25;

    private isDraggingBuild: boolean = false;
    private lastBuildPos: string = "";

    public guiState = {
        x: '0.00',
        y: '0.00',
        z: '0.00'
    };

    constructor(canvas: HTMLCanvasElement, world: World, physicsFacade: PhysicsFacade, soundManager: SoundManager, buildManager: BuildManager, entityRepo: EntityRepository) {
        this.world = world;
        this.physicsFacade = physicsFacade;
        this.buildManager = buildManager;
        this.entityRepo = entityRepo;
        
        const spawnX = 21.00;
        const spawnY = 5.0;
        const spawnZ = 3.0;
        
        this.camera = new Camera(vec3.fromValues(spawnX, spawnY, spawnZ), 90.0, 0.0);
        this.targetPosition = vec3.fromValues(spawnX, spawnY, spawnZ);
        
        this.input = new Input(canvas);
        this.playerId = this.physicsFacade.generateId();

        this.soundManager = soundManager;

        globalEventBus.on("SET_TOOL_SETTINGS", (data: any) => {
            if (data.mineCooldownMs !== undefined) this.mineCooldownMs = data.mineCooldownMs;
            if (data.buildCooldownMs !== undefined) this.buildCooldownMs = data.buildCooldownMs;
            if (data.destructionRadius !== undefined) this.destructionRadius = data.destructionRadius;
        });

        globalEventBus.on("TOGGLE_BUILD_MODE", (data) => {
            this.isBuildMode = data.enabled !== undefined ? data.enabled : !this.isBuildMode;
            if (!this.isBuildMode) {
                globalEventBus.emit("PHYSICS_COMMAND", {
                    type: 'CREATE_PLAYER', 
                    id: this.playerId,
                    x: this.camera.position[0], 
                    y: this.camera.position[1], 
                    z: this.camera.position[2],
                    radius: 0.2,
                    halfHeight: 0.3
                });
            }
        });

        canvas.addEventListener("mousedown", (e) => {
            this.soundManager.unlock();
            if (this.input.isLocked) {
                if (e.button === 0) {
                    if (!this.isBuildMode && this.currentHitEntity !== null) {
                        this.draggedEntityId = this.currentHitEntity;
                        const t = this.physicsFacade.transforms.get(this.currentHitEntity);
                        if (t) {
                            this.dragDistance = vec3.distance(this.camera.position, t.position);
                        } else {
                            this.dragDistance = 5.0; 
                        }
                    } else {
                        this.handleLeftClick();
                    }
                } else if (e.button === 2) {
                    if (!this.isBuildMode && this.currentHitEntityInternalId !== null) {
                        const interactable = this.entityRepo.interactables.get(this.currentHitEntityInternalId);
                        if (interactable) {
                            globalEventBus.emit("SHOW_OVERLAY", { data: interactable.overlayData });
                            return; 
                        }
                    }

                    if (this.buildManager.isActive) {
                        if (this.buildManager.selectedBlockId >= 900) {
                            let selectedModelId = "billboard";
                            let customIdCounter = 999;
                            for (const modelId in ProjectRegistry) {
                                if (customIdCounter === this.buildManager.selectedBlockId) {
                                    selectedModelId = modelId;
                                    break;
                                }
                                customIdCounter--;
                            }
                            this.handleBillboardPlacement(selectedModelId);
                        } else {
                            if (this.buildManager.activeTool === 'SINGLE') {
                                this.isDraggingBuild = true;
                                this.handleBuildPlacement();
                            } else if (this.buildManager.activeTool === 'BOX' || this.buildManager.activeTool === 'DYNAMIC_BOX' || this.buildManager.activeTool === 'CUT_BOX') {
                                this.handleBoxToolClick();
                            } else if (this.buildManager.activeTool === 'SPHERE' || this.buildManager.activeTool === 'SMOOTH' || this.buildManager.activeTool === 'DYNAMITE') {
                                this.isDraggingBuild = true;
                                this.handleSculptPlacement();
                            }
                        }
                    }
                }
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                if (this.draggedEntityId !== null) {
                    this.draggedEntityId = null;
                }
            } else if (e.button === 2) {
                this.isDraggingBuild = false;
                this.lastBuildPos = "";

                if (this.buildManager.isActive && this.input.isLocked) {
                    if (this.buildManager.activeTool === 'BOX' || this.buildManager.activeTool === 'DYNAMIC_BOX' || this.buildManager.activeTool === 'CUT_BOX') {
                         this.handleBoxToolClick();
                    }
                }
            }
        });

        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    public spawn(): void {
        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_PLAYER',
            id: this.playerId,
            x: this.targetPosition[0], 
            y: this.targetPosition[1], 
            z: this.targetPosition[2],
            radius: 0.2,
            halfHeight: 0.3
        });
    }

    public getCameraPosition(): vec3 {
        return this.camera.position;
    }

    public update(deltaTime: number): void {
        if (!this.isBuildMode) {
            const transform = this.physicsFacade.transforms.get(this.playerId);
            if (transform) {
                vec3.set(this.targetPosition, transform.position[0], transform.position[1] + 0.3, transform.position[2]);
                const lerpSpeed = 15.0; 
                const t = Math.min(lerpSpeed * deltaTime, 1.0);
                vec3.lerp(this.camera.position, this.camera.position, this.targetPosition, t);
            }
        }

        this.guiState.x = this.camera.position[0].toFixed(2);
        this.guiState.y = this.camera.position[1].toFixed(2);
        this.guiState.z = this.camera.position[2].toFixed(2);

        const mouse = this.input.consumeMouseDeltas();
        if (mouse.x !== 0 || mouse.y !== 0) {
            this.camera.processMouseMovement(mouse.x, mouse.y);
        }
        
        this.soundManager.updateListener(this.camera.position, this.camera.front, this.camera.up);

        this.acousticTimer += deltaTime;
        if (this.acousticTimer >= this.ACOUSTIC_INTERVAL) {
            this.evaluateAcousticEnvironment();
            this.acousticTimer = 0;
        }

        const reach = 25.0; 
        const gridHit = VoxelRaycaster.raycastGrid(this.camera.position, this.camera.front, reach, this.world);
        
        if (this.buildManager.activeTool === 'SPHERE' || this.buildManager.activeTool === 'SMOOTH' || this.buildManager.activeTool === 'DYNAMITE' || this.buildManager.activeTool === 'CUT_BOX') {
            if (gridHit.hit) {
                this.currentPlacementTarget = vec3.fromValues(gridHit.blockPos[0], gridHit.blockPos[1], gridHit.blockPos[2]);
            } else {
                this.currentPlacementTarget = null;
            }
        } else {
            if (gridHit.hit && gridHit.normal) {
                this.currentPlacementTarget = vec3.fromValues(
                    gridHit.blockPos[0] + gridHit.normal[0],
                    gridHit.blockPos[1] + gridHit.normal[1],
                    gridHit.blockPos[2] + gridHit.normal[2]
                );
            } else {
                this.currentPlacementTarget = null;
            }
        }

        if (this.isBuildMode) {
            const flyVel = vec3.create();
            const front = vec3.fromValues(this.camera.front[0], this.camera.front[1], this.camera.front[2]);
            vec3.normalize(front, front);
            const right = vec3.create();
            vec3.cross(right, front, [0, 1, 0]);
            vec3.normalize(right, right);
            const up = vec3.fromValues(0, 1, 0);

            if (this.input.isKeyPressed("KeyW")) vec3.scaleAndAdd(flyVel, flyVel, front, this.flySpeed);
            if (this.input.isKeyPressed("KeyS")) vec3.scaleAndAdd(flyVel, flyVel, front, -this.flySpeed);
            if (this.input.isKeyPressed("KeyA")) vec3.scaleAndAdd(flyVel, flyVel, right, -this.flySpeed);
            if (this.input.isKeyPressed("KeyD")) vec3.scaleAndAdd(flyVel, flyVel, right, this.flySpeed);
            if (this.input.isKeyPressed("Space")) vec3.scaleAndAdd(flyVel, flyVel, up, this.flySpeed);
            if (this.input.isKeyPressed("ShiftLeft")) vec3.scaleAndAdd(flyVel, flyVel, up, -this.flySpeed);

            vec3.scaleAndAdd(this.camera.position, this.camera.position, flyVel, deltaTime);
            vec3.copy(this.targetPosition, this.camera.position); 

        } else {
            const velocity = vec3.create();
            const front = vec3.fromValues(this.camera.front[0], 0, this.camera.front[2]);
            vec3.normalize(front, front);
            const right = vec3.create();
            vec3.cross(right, front, [0, 1, 0]);
            vec3.normalize(right, right);

            if (this.input.isKeyPressed("KeyW")) vec3.scaleAndAdd(velocity, velocity, front, this.walkSpeed);
            if (this.input.isKeyPressed("KeyS")) vec3.scaleAndAdd(velocity, velocity, front, -this.walkSpeed);
            if (this.input.isKeyPressed("KeyA")) vec3.scaleAndAdd(velocity, velocity, right, -this.walkSpeed);
            if (this.input.isKeyPressed("KeyD")) vec3.scaleAndAdd(velocity, velocity, right, this.walkSpeed);

            const isJumping = this.input.isKeyPressed("Space");

            globalEventBus.emit("PHYSICS_COMMAND", {
                type: 'SET_PLAYER_VELOCITY',
                id: this.playerId,
                x: velocity[0],
                z: velocity[2],
                jump: isJumping
            });

            if (this.draggedEntityId !== null && this.input.isMouseButtonPressed(0)) {
                const targetPos = vec3.create();
                vec3.scaleAndAdd(targetPos, this.camera.position, this.camera.front, this.dragDistance);

                globalEventBus.emit("PHYSICS_COMMAND", {
                    type: 'DRAG_ENTITY',
                    id: this.draggedEntityId,
                    targetX: targetPos[0],
                    targetY: targetPos[1],
                    targetZ: targetPos[2]
                });
            } else if (this.draggedEntityId !== null) {
                this.draggedEntityId = null;
            }
        }

        if (this.input.isKeyPressed("KeyB") && this.canThrowBomb) {
            this.canThrowBomb = false;
            setTimeout(() => this.canThrowBomb = true, 500); 

            const spawnPos = vec3.create();
            vec3.scaleAndAdd(spawnPos, this.camera.position, this.camera.front, 1.0);

            const throwVel = vec3.create();
            vec3.scale(throwVel, this.camera.front, 15.0);
            throwVel[1] += 5.0; 

            const rotation = quat.create();
            quat.rotationTo(rotation, [0, 0, -1], this.camera.front);

            globalEventBus.emit("SPAWN_BOMB", {
                x: spawnPos[0], y: spawnPos[1], z: spawnPos[2],
                vx: throwVel[0], vy: throwVel[1], vz: throwVel[2],
                rot: { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] }
            });
        }

        if (this.isDraggingBuild && this.buildManager.isActive && this.buildManager.selectedBlockId < 900) {
            if (this.buildManager.activeTool === 'SINGLE') {
                this.handleBuildPlacement();
            } else if (this.buildManager.activeTool === 'SPHERE' || this.buildManager.activeTool === 'SMOOTH' || this.buildManager.activeTool === 'DYNAMITE' || this.buildManager.activeTool === 'CUT_BOX') {
                this.handleSculptPlacement();
            }
        }
        
        this.physicsFacade.raycast(this.camera.position, this.camera.front, 10.0, this.playerId).then(res => {
            if (res.hit && res.hitId !== undefined) {
                this.currentHitEntity = res.hitId;
                
                let foundEntityId = null;
                for (const [id, physComp] of this.entityRepo.physics.entries()) {
                    if (physComp.bodyId === res.hitId) {
                        foundEntityId = id;
                        break;
                    }
                }
                this.currentHitEntityInternalId = foundEntityId;
            } else {
                this.currentHitEntity = null;
                this.currentHitEntityInternalId = null;
            }
        });
    }

    private evaluateAcousticEnvironment(): void {
        const rayDirections: vec3[] = [
            [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]
        ];

        const MAX_RAY_DISTANCE = 32.0;
        let totalDistance = 0;

        for (const dir of rayDirections) {
            const hit = VoxelRaycaster.raycastGrid(this.camera.position, dir, MAX_RAY_DISTANCE, this.world);
            totalDistance += hit.hit ? hit.distance : MAX_RAY_DISTANCE;
        }

        const averageDistance = totalDistance / 6.0;
        let enclosure = 1.0 - (averageDistance / MAX_RAY_DISTANCE);
        enclosure = Math.max(0.0, Math.min(1.0, enclosure));

        this.soundManager.setEnclosureFactor(enclosure);
    }

    private async handleLeftClick(): Promise<void> {
        if (!this.canMine) return;
        
        this.canMine = false;
        setTimeout(() => this.canMine = true, this.mineCooldownMs);

        const reach = this.isBuildMode ? 40.0 : 10.0;
        
        const gridHit = VoxelRaycaster.raycastGrid(this.camera.position, this.camera.front, reach, this.world);
        const physicsHit = await this.physicsFacade.raycast(this.camera.position, this.camera.front, reach, this.playerId);

        let hitGridFirst = false;
        if (gridHit.hit && !physicsHit.hit) hitGridFirst = true;
        else if (gridHit.hit && physicsHit.hit && gridHit.distance < physicsHit.distance) hitGridFirst = true;

        if (this.isBuildMode && this.buildManager.activeTool === 'SINGLE') {
            if (hitGridFirst) {
                const [x, y, z] = gridHit.blockPos;
                this.buildManager.removeSingle(x, y, z);
            } else if (physicsHit.hit && physicsHit.hitId !== undefined) {
                globalEventBus.emit("REMOVE_BILLBOARD_BY_BODY", { bodyId: physicsHit.hitId });
                
                this.buildManager.removeSingleDebri(
                    physicsHit.hitId,
                    physicsHit.localX!,
                    physicsHit.localY!,
                    physicsHit.localZ!
                );
            }
            return;
        }

        if (hitGridFirst) {
            const [x, y, z] = gridHit.blockPos;
            const blockType = this.world.getBlock(x, y, z);
            globalEventBus.emit("BLOCK_MINED_STATIC", { x, y, z, radius: this.destructionRadius, blockType });
        } else if (physicsHit.hit && physicsHit.hitId !== undefined) {
            globalEventBus.emit("BLOCK_MINED_DYNAMIC", {
                debriId: physicsHit.hitId,
                localX: physicsHit.localX!,
                localY: physicsHit.localY!,
                localZ: physicsHit.localZ!,
                radius: this.destructionRadius
            });
        }
    }

    private handleBillboardPlacement(modelId: string): void {
        const reach = 10.0;
        const gridHit = VoxelRaycaster.raycastGrid(this.camera.position, this.camera.front, reach, this.world);

        if (gridHit.hit) {
            const spawnPos = vec3.create();
            vec3.scaleAndAdd(spawnPos, this.camera.position, this.camera.front, gridHit.distance);
            vec3.scaleAndAdd(spawnPos, spawnPos, this.camera.front, -0.1); 

            const lookDir = vec3.create();
            vec3.negate(lookDir, this.camera.front);
            lookDir[1] = 0; 
            vec3.normalize(lookDir, lookDir);

            const rotation = quat.create();
            quat.rotationTo(rotation, [0, 0, 1], lookDir);

            const bodyId = this.physicsFacade.generateId();

            globalEventBus.emit("SPAWN_BILLBOARD", {
                x: spawnPos[0],
                y: spawnPos[1],
                z: spawnPos[2],
                rot: { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] },
                modelId: modelId,
                bodyId: bodyId
            });

            this.buildManager.recordBillboardSpawn(bodyId);
        }
    }

    private handleBoxToolClick(): void {
        if (!this.currentPlacementTarget) return;
        const [x, y, z] = this.currentPlacementTarget;
        this.buildManager.registerBoxPoint(x, y, z);
    }

    private handleBuildPlacement(): void {
        if (!this.currentPlacementTarget) return;
        if (!this.canBuild) return;

        this.canBuild = false;
        setTimeout(() => this.canBuild = true, this.buildCooldownMs);

        const [x, y, z] = this.currentPlacementTarget;
        const posKey = `${x},${y},${z}`;
        
        if (this.lastBuildPos === posKey) return;
        this.lastBuildPos = posKey;

        this.buildManager.placeSingle(x, y, z);
    }

    private handleSculptPlacement(): void {
        if (!this.currentPlacementTarget) return;
        if (!this.canBuild) return;

        this.canBuild = false;
        setTimeout(() => this.canBuild = true, this.buildCooldownMs);

        const [x, y, z] = this.currentPlacementTarget;
        
        this.buildManager.executeSculptAction(x, y, z);
    }
}