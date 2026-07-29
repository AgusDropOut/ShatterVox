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


    private rigidBody: RAPIER.RigidBody;
    private collider: RAPIER.Collider;
    private speed: number = 1.0;
    private jumpForce: number = 7.0;

    constructor(canvas: HTMLCanvasElement, world: World, physicsWorld: RAPIER.World) {
        this.world = world;
        this.physicsWorld = physicsWorld;
        
     
        this.camera = new Camera(vec3.fromValues(0, 0, 0));
        this.input = new Input(canvas);

   
        
        const rbDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(5, 10, 5)
            .lockRotations();
         
        
        this.rigidBody = this.physicsWorld.createRigidBody(rbDesc);

       
        const colDesc = RAPIER.ColliderDesc.capsule(0.6, 0.2);
        this.collider = this.physicsWorld.createCollider(colDesc, this.rigidBody);

     
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

       
        const currentLinVel = this.rigidBody.linvel();
        let velY = currentLinVel.y;

       
        if (this.input.isKeyPressed("Space") && Math.abs(currentLinVel.y) < 0.01) {
            velY = this.jumpForce;
        }

      
        this.rigidBody.setLinvel({ x: velocity[0], y: velY, z: velocity[2] }, true);
        const pos = this.rigidBody.translation();
        vec3.set(this.camera.position, pos.x, pos.y + 0.8, pos.z);
    }

    private handleLeftClick(): void {
        const reach = 5.0; 
        
        const gridHit = VoxelRaycaster.raycastGrid(this.camera.position, this.camera.front, reach, this.world);
        const physicsHit = VoxelRaycaster.raycastPhysics(this.camera.position, this.camera.front, reach, this.physicsWorld, this.collider);

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