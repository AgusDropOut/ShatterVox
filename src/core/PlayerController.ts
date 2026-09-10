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
import { GameplayMode, BuildMode} from "./player/PlayerModes";
import type { IPlayerMode } from "../types/PlayerMode";

export class PlayerController {
    public readonly camera: Camera;
    public readonly input: Input;
    public readonly world: World;
    public readonly physicsFacade: PhysicsFacade;
    public readonly buildManager: BuildManager;
    public readonly entityRepo: EntityRepository;
    public readonly playerId: number;
    
    public walkSpeed: number = 2.8;
    public flySpeed: number = 8.0;
    
    public canThrowBomb: boolean = true;
    public canMine: boolean = true;
    public canBuild: boolean = true;
    
    public mineCooldownMs: number = 100; 
    public buildCooldownMs: number = 100; 
    public destructionRadius: number = 6;

    public targetPosition: vec3;
    public currentPlacementTarget: vec3 | null = null;
    public currentHitEntity: number | null = null; 
    public currentHitEntityInternalId: number | null = null;

    public draggedEntityId: number | null = null;
    public dragDistance: number = 0;
    public isDraggingBuild: boolean = false;
    public lastBuildPos: string = "";

    public selectedThrowableId: string = "bomb";

    private soundManager: SoundManager;
    private acousticTimer: number = 0;
    private readonly ACOUSTIC_INTERVAL: number = 0.25;

    private currentMode!: IPlayerMode;
    private gameplayMode: GameplayMode;
    private buildMode: BuildMode;

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

        this.gameplayMode = new GameplayMode();
        this.buildMode = new BuildMode();
        this.setMode(this.gameplayMode);

        globalEventBus.on("SET_TOOL_SETTINGS", (data: any) => {
            if (data.mineCooldownMs !== undefined) this.mineCooldownMs = data.mineCooldownMs;
            if (data.buildCooldownMs !== undefined) this.buildCooldownMs = data.buildCooldownMs;
            if (data.destructionRadius !== undefined) this.destructionRadius = data.destructionRadius;
        });

        globalEventBus.on("SET_THROWABLE", (data) => {
            this.selectedThrowableId = data.id;
        });

        globalEventBus.on("TOGGLE_BUILD_MODE", (data) => {
            const enableBuild = data.enabled !== undefined ? data.enabled : this.currentMode === this.gameplayMode;
            if (enableBuild && this.currentMode !== this.buildMode) {
                this.setMode(this.buildMode);
            } else if (!enableBuild && this.currentMode !== this.gameplayMode) {
                this.setMode(this.gameplayMode);
            }
        });

        canvas.addEventListener("mousedown", (e) => {
            this.soundManager.unlock();
            if (this.input.isLocked) {
                if (e.button === 0) this.currentMode.onLeftClickDown(this);
                else if (e.button === 2) this.currentMode.onRightClickDown(this);
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) this.currentMode.onLeftClickUp(this);
            else if (e.button === 2) this.currentMode.onRightClickUp(this);
        });

        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    private setMode(mode: IPlayerMode): void {
        if (this.currentMode) this.currentMode.onExit(this);
        this.currentMode = mode;
        this.currentMode.onEnter(this);
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

        this.currentMode.update(this, deltaTime);
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

    public throwItem(): void {
        if (!this.canThrowBomb) return;
        this.canThrowBomb = false;
        setTimeout(() => this.canThrowBomb = true, 500); 

        const spawnPos = vec3.create();
        vec3.scaleAndAdd(spawnPos, this.camera.position, this.camera.front, 1.0);

        const throwVel = vec3.create();
        vec3.scale(throwVel, this.camera.front, 15.0);
        throwVel[1] += 5.0; 

        const rotation = quat.create();
        quat.rotationTo(rotation, [0, 0, -1], this.camera.front);

        globalEventBus.emit("SPAWN_ENTITY", {
            modelId: this.selectedThrowableId,
            x: spawnPos[0], y: spawnPos[1], z: spawnPos[2],
            vx: throwVel[0], vy: throwVel[1], vz: throwVel[2],
            rot: { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] }
        });
    }

    public handleBillboardPlacement(modelId: string): void {
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

            globalEventBus.emit("SPAWN_ENTITY", {
                x: spawnPos[0],
                y: spawnPos[1],
                z: spawnPos[2],
                rot: { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] },
                modelId: modelId
            });
        }
    }

    public handleBoxToolClick(): void {
        if (!this.currentPlacementTarget) return;
        const [x, y, z] = this.currentPlacementTarget;
        this.buildManager.registerBoxPoint(x, y, z);
    }

    public handleBuildPlacement(): void {
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

    public handleSculptPlacement(): void {
        if (!this.currentPlacementTarget) return;
        if (!this.canBuild) return;

        this.canBuild = false;
        setTimeout(() => this.canBuild = true, this.buildCooldownMs);

        const [x, y, z] = this.currentPlacementTarget;
        
        this.buildManager.executeSculptAction(x, y, z);
    }
}