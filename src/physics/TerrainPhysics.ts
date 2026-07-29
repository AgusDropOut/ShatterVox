import RAPIER from "@dimforge/rapier3d-compat";
import { globalEventBus } from "../core/EventBus";
import type { World } from "../world/World";

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

        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            this.removeColliderAt(data.x, data.y, data.z);
        });
    }

 
    public buildColliders(world: World): void {
        for (const chunk of world.chunks.values()) {
            for (let x = 0; x < 16; x++) {
                for (let y = 0; y < 16; y++) {
                    for (let z = 0; z < 16; z++) {
                        const blockId = chunk.getBlock(x, y, z);

                        if (blockId !== 0) {
                            const worldX = chunk.chunkX * 16 + x;
                            const worldY = chunk.chunkY * 16 + y;
                            const worldZ = chunk.chunkZ * 16 + z;

                            const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
                                .setTranslation(worldX + 0.5, worldY + 0.5, worldZ + 0.5);
                            
                            const collider = this.physicsWorld.createCollider(colliderDesc, this.rigidBody);
                            
                       
                            this.colliders.set(`${worldX},${worldY},${worldZ}`, collider);
                        }
                    }
                }
            }
        }
    }

   public removeColliders(blocks: number[][]): void {
        for (const [x, y, z] of blocks) {
            this.removeColliderAt(x, y, z);
        }
    }

    public removeColliderAt(x: number, y: number, z: number): void {
        const key = `${x},${y},${z}`;
        const collider = this.colliders.get(key);
        if (collider) {
            this.physicsWorld.removeCollider(collider, true);
            this.colliders.delete(key);
            console.log(`[TerrainPhysics] Removed collider at global (${x}, ${y}, ${z})`);
        }
    }

   
}