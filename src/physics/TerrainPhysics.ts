import RAPIER from "@dimforge/rapier3d-compat";
import { Chunk } from "../world/Chunk";

export class TerrainPhysics {
    public readonly rigidBody: RAPIER.RigidBody;
    private readonly physicsWorld: RAPIER.World;
    private colliders: Map<string, RAPIER.Collider> = new Map();

    constructor(physicsWorld: RAPIER.World) {
        this.physicsWorld = physicsWorld;

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
        this.rigidBody = this.physicsWorld.createRigidBody(bodyDesc);

        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(17.0, 0.5, 17.0)
            .setTranslation(0, -0.5, 0); 
        this.physicsWorld.createCollider(groundColliderDesc, this.rigidBody);
    }

 
    public buildColliders(chunk: Chunk): void {


        for (let x = 0; x < Chunk.WIDTH; x++) {
            for (let y = 0; y < Chunk.HEIGHT; y++) {
                for (let z = 0; z < Chunk.DEPTH; z++) {
                    const blockId = chunk.getBlock(x, y, z);
                    
                    if (blockId === 0) continue;

                   
                    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
                        .setTranslation(x + 0.5, y + 0.5, z + 0.5);

                    this.colliders.set(`${x},${y},${z}`, this.physicsWorld.createCollider(colliderDesc, this.rigidBody));
                    
                }
            }
        }
    }

    public removeColliders(blocks: number[][]): void {
        for (const [x, y, z] of blocks) {
            const key = `${x},${y},${z}`;
            const collider = this.colliders.get(key);
            if (collider) {
                this.physicsWorld.removeCollider(collider, true);
                this.colliders.delete(key);
                console.log(`[TerrainPhysics] Removed collider at (${x}, ${y}, ${z})`);
            }
        }
    }

    public removeColliderAt(x: number, y: number, z: number): void {
        const key = `${x},${y},${z}`;
        const collider = this.colliders.get(key);
        if (collider) {
            this.physicsWorld.removeCollider(collider, true);
            this.colliders.delete(key);
            console.log(`[TerrainPhysics] Removed collider at (${x}, ${y}, ${z})`);
        }
    }

   
}