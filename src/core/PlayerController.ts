import { Camera } from "../core/Camera";
import { Input } from "./Input";
import { World } from "../world/World";
import { globalEventBus } from "./EventBus";
import { vec3, quat } from "gl-matrix";
import type { PhysicsFacade } from "../physics/PhysicsFacade";
import { VoxelRaycaster } from "../physics/VoxelRaycaster";
import type { SoundManager } from "../audio/SoundManager";

export class PlayerController {
    public readonly camera: Camera;
    public readonly input: Input;
    private readonly world: World;
    private readonly physicsFacade: PhysicsFacade;
    public readonly playerId: number;
    private speed: number = 6.0;
    private canThrowBomb: boolean = true;

    public targetPosition: vec3;
    private soundManager: SoundManager;

    private acousticTimer: number = 0;
    private readonly ACOUSTIC_INTERVAL: number = 0.25;

    constructor(canvas: HTMLCanvasElement, world: World, physicsFacade: PhysicsFacade, soundManager: SoundManager) {
        this.world = world;
        this.physicsFacade = physicsFacade;
        this.camera = new Camera(vec3.fromValues(5, 0, 5));
        this.targetPosition = vec3.fromValues(5, 0.8, 5);
        this.input = new Input(canvas);
        this.playerId = this.physicsFacade.generateId();

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_PLAYER',
            id: this.playerId,
            x: 5, y: 10, z: 5,
            radius: 0.2,
            halfHeight: 0.6
        });

        this.soundManager = soundManager;

        canvas.addEventListener("mousedown", (e) => {
            this.soundManager.unlock();
            if (this.input.isLocked) {
                if (e.button === 0) {
                    this.handleLeftClick();
                } else if (e.button === 2) {
                    this.handleRightClick();
                }
            }
        });

        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    public update(deltaTime: number): void {
        const transform = this.physicsFacade.transforms.get(this.playerId);
        if (transform) {
            vec3.set(this.targetPosition, transform.position[0], transform.position[1] + 0.8, transform.position[2]);
            
            const lerpSpeed = 15.0; 
            const t = Math.min(lerpSpeed * deltaTime, 1.0);
            vec3.lerp(this.camera.position, this.camera.position, this.targetPosition, t);
        }

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

        const velocity = vec3.create();
        const front = vec3.fromValues(this.camera.front[0], 0, this.camera.front[2]);
        vec3.normalize(front, front);
        const right = vec3.create();
        vec3.cross(right, front, [0, 1, 0]);
        vec3.normalize(right, right);

        if (this.input.isKeyPressed("KeyW")) vec3.scaleAndAdd(velocity, velocity, front, this.speed);
        if (this.input.isKeyPressed("KeyS")) vec3.scaleAndAdd(velocity, velocity, front, -this.speed);
        if (this.input.isKeyPressed("KeyA")) vec3.scaleAndAdd(velocity, velocity, right, -this.speed);
        if (this.input.isKeyPressed("KeyD")) vec3.scaleAndAdd(velocity, velocity, right, this.speed);

        const isJumping = this.input.isKeyPressed("Space");

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'SET_PLAYER_VELOCITY',
            id: this.playerId,
            x: velocity[0],
            z: velocity[2],
            jump: isJumping
        });

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
    }

    private evaluateAcousticEnvironment(): void {
        const rayDirections: vec3[] = [
            [0, 1, 0],
            [0, -1, 0],
            [1, 0, 0],
            [-1, 0, 0],
            [0, 0, 1],
            [0, 0, -1]
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
        const reach = 10.0; 
        
        const gridHit = VoxelRaycaster.raycastGrid(this.camera.position, this.camera.front, reach, this.world);
        const physicsHit = await this.physicsFacade.raycast(this.camera.position, this.camera.front, reach, this.playerId);

        let hitGridFirst = false;
        if (gridHit.hit && !physicsHit.hit) hitGridFirst = true;
        else if (gridHit.hit && physicsHit.hit && gridHit.distance < physicsHit.distance) hitGridFirst = true;

        if (hitGridFirst) {
            const [x, y, z] = gridHit.blockPos;
            const blockType = this.world.getBlock(x, y, z);
            globalEventBus.emit("BLOCK_MINED_STATIC", { x, y, z, radius: 3, blockType });
        } else if (physicsHit.hit && physicsHit.hitId !== undefined) {
            globalEventBus.emit("BLOCK_MINED_DYNAMIC", {
                debriId: physicsHit.hitId,
                localX: physicsHit.localX!,
                localY: physicsHit.localY!,
                localZ: physicsHit.localZ!,
                radius: 3
            });
        }
    }

    private async handleRightClick(): Promise<void> {
        const reach = 10.0;
        console.log("Right click detected. Performing raycast for billboard placement.");
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

            globalEventBus.emit("SPAWN_BILLBOARD", {
                x: spawnPos[0],
                y: spawnPos[1],
                z: spawnPos[2],
                rot: { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] }
            });
        }
    }
}