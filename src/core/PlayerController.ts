import { Camera } from "./Camera";
import { Input } from "./Input";
import { World } from "../world/World";
import RAPIER from "@dimforge/rapier3d-compat";
import { VoxelRaycaster } from "../physics/VoxelRaycaster";
import { ColliderRegistry } from "../physics/ColliderRegistry";
import { globalEventBus } from "./EventBus";
import { vec3 } from "gl-matrix";

export class PlayerController {
    public readonly camera: Camera;
    public readonly input: Input;
    
    private readonly world: World;
    private readonly physicsWorld: RAPIER.World;

    constructor(canvas: HTMLCanvasElement, world: World, physicsWorld: RAPIER.World) {
        this.world = world;
        this.physicsWorld = physicsWorld;
        
        this.camera = new Camera(vec3.fromValues(4, 4, 10));
        this.input = new Input(canvas);


        canvas.addEventListener("mousedown", (e) => {
            if (this.input.isLocked && e.button === 0) {
                this.handleLeftClick();
            }
        });
    }

    public update(deltaTime: number): void {
        if (!this.input.isLocked) return;

        const mouse = this.input.consumeMouseDeltas();
        if (mouse.x !== 0 || mouse.y !== 0) {
            this.camera.processMouseMovement(mouse.x, mouse.y);
        }

        if (this.input.isKeyPressed("KeyW")) this.camera.processKeyboard("FORWARD", deltaTime);
        if (this.input.isKeyPressed("KeyS")) this.camera.processKeyboard("BACKWARD", deltaTime);
        if (this.input.isKeyPressed("KeyA")) this.camera.processKeyboard("LEFT", deltaTime);
        if (this.input.isKeyPressed("KeyD")) this.camera.processKeyboard("RIGHT", deltaTime);
        
        if (this.input.isKeyPressed("Space")) this.camera.processKeyboard("UP", deltaTime);
        if (this.input.isKeyPressed("ShiftLeft")) this.camera.processKeyboard("DOWN", deltaTime);
    }

   
    private handleLeftClick(): void {
        const reach = 5.0; 
        
        const gridHit = VoxelRaycaster.raycastGrid(this.camera.position, this.camera.front, reach, this.world);
        const physicsHit = VoxelRaycaster.raycastPhysics(this.camera.position, this.camera.front, reach, this.physicsWorld);

        if (!gridHit.hit && !physicsHit.hit) return;

        if (gridHit.distance < physicsHit.distance) {
            const [x, y, z] = gridHit.blockPos;
            globalEventBus.emit("BLOCK_MINED_STATIC", { x, y, z });
        } else {
            const handle = physicsHit.colliderHandle!;
            const voxelData = ColliderRegistry.get(handle);

            if (voxelData) {
                const colliderToDestroy = this.physicsWorld.getCollider(handle);
                if (colliderToDestroy) {
                    this.physicsWorld.removeCollider(colliderToDestroy, true);
                }
                ColliderRegistry.delete(handle);
                
                globalEventBus.emit("BLOCK_MINED_DYNAMIC", { 
                    debri: voxelData.debri, 
                    handle: handle, 
                    localX: voxelData.localX, 
                    localY: voxelData.localY, 
                    localZ: voxelData.localZ 
                });
            }
        }
    }
}