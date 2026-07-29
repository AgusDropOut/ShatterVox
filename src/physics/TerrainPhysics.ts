import RAPIER from "@dimforge/rapier3d-compat";
import { globalEventBus } from "../core/EventBus";
import type { World } from "../world/World";
import { Engine } from "../core/Engine";
import { Chunk } from "../world/Chunk";

export class TerrainPhysics {
    public readonly rigidBody: RAPIER.RigidBody;
    private readonly physicsWorld: RAPIER.World;
    private colliders: Map<string, RAPIER.Collider> = new Map();

    constructor(physicsWorld: RAPIER.World) {
        this.physicsWorld = physicsWorld;

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
        this.rigidBody = this.physicsWorld.createRigidBody(bodyDesc);

        // 1. Calculamos el tamaño total del mundo (4 chunks de 32 = 128 bloques)
        const worldBlocksX = 4 * Chunk.WIDTH;
        const worldBlocksZ = 4 * Chunk.DEPTH;
        
        // 2. Calculamos los Half-Extents de la caja gigante del suelo
        const halfW = (worldBlocksX * Engine.voxelSize) / 2;
        const halfD = (worldBlocksZ * Engine.voxelSize) / 2;
        const halfH = Engine.voxelSize / 2;

        // 3. Creamos UNA SOLA CAJA que cubre todo el Y=0
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
            .setTranslation(halfW, halfH, halfD); 
        
        this.physicsWorld.createCollider(groundColliderDesc, this.rigidBody);

        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            this.removeColliderAt(data.x, data.y, data.z);
        });
    }

    public buildColliders(world: World): void {
        for (const chunk of world.chunks.values()) {
            for (let x = 0; x < Chunk.WIDTH; x++) {
                for (let y = 0; y < Chunk.HEIGHT; y++) {
                    for (let z = 0; z < Chunk.DEPTH; z++) {
                        
                        const worldY = chunk.chunkY * Chunk.HEIGHT + y;
                        
                        // ¡LA MAGIA! Ignoramos la capa 0 porque ya está cubierta por la caja gigante
                        if (worldY === 0) continue;

                        const blockId = chunk.getBlock(x, y, z);

                        if (blockId !== 0) {
                            const worldX = chunk.chunkX * Chunk.WIDTH + x;
                            const worldZ = chunk.chunkZ * Chunk.DEPTH + z;

                            const half = Engine.voxelSize / 2;

                            const colliderDesc = RAPIER.ColliderDesc.cuboid(half, half, half)
                                .setTranslation(
                                    worldX * Engine.voxelSize + half, 
                                    worldY * Engine.voxelSize + half, 
                                    worldZ * Engine.voxelSize + half
                                );
                            
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
        }
    }
}