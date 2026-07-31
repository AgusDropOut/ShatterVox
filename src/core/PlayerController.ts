import { Camera } from "./Camera";
import { Input } from "./Input";
import { World } from "../world/World";
import { globalEventBus } from "./EventBus";
import { vec3 } from "gl-matrix";
import type { PhysicsFacade } from "../physics/PhysicsFacade";
import { VoxelRaycaster } from "../physics/VoxelRaycaster";

export class PlayerController {
    public readonly camera: Camera;
    public readonly input: Input;
    private readonly world: World;
    private readonly physicsFacade: PhysicsFacade;
    public readonly playerId: number;
    private speed: number = 6.0;

    private targetPosition: vec3;

    constructor(canvas: HTMLCanvasElement, world: World, physicsFacade: PhysicsFacade) {
        this.world = world;
        this.physicsFacade = physicsFacade;
        this.camera = new Camera(vec3.fromValues(5, 10, 5));
        this.targetPosition = vec3.fromValues(5, 10.8, 5);
        this.input = new Input(canvas);
        this.playerId = this.physicsFacade.generateId();

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_PLAYER',
            id: this.playerId,
            x: 5, y: 10, z: 5,
            radius: 0.2,
            halfHeight: 0.6
        });

        canvas.addEventListener("mousedown", (e) => {
            if (this.input.isLocked && e.button === 0) {
                this.handleLeftClick();
            }
        });
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
            globalEventBus.emit("BLOCK_MINED_STATIC", { x, y, z });
        } else if (physicsHit.hit && physicsHit.hitId !== undefined) {
            globalEventBus.emit("BLOCK_MINED_DYNAMIC", {
                debriId: physicsHit.hitId,
                localX: physicsHit.localX!,
                localY: physicsHit.localY!,
                localZ: physicsHit.localZ!
            });
        }
    }
}