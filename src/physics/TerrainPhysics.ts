import { globalEventBus } from "../core/EventBus";
import type { World } from "../world/World";
import { Engine } from "../core/Engine";
import { Chunk } from "../world/Chunk";

export class TerrainPhysics {
    constructor() {
        const worldBlocksX = 4 * Chunk.WIDTH;
        const worldBlocksZ = 4 * Chunk.DEPTH;
        
        const halfW = (worldBlocksX * Engine.voxelSize) / 2;
        const halfD = (worldBlocksZ * Engine.voxelSize) / 2;
        const halfH = Engine.voxelSize / 2;

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_STATIC_BOX',
            id: 0,
            halfW: halfW,
            halfH: halfH,
            halfD: halfD,
            x: halfW,
            y: halfH,
            z: halfD
        });

        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            this.removeColliderAt(data.x, data.y, data.z);
        });
    }

    public buildColliders(world: World): void {
        const positions: number[] = [];

        for (const chunk of world.chunks.values()) {
            for (let x = 0; x < Chunk.WIDTH; x++) {
                for (let y = 0; y < Chunk.HEIGHT; y++) {
                    for (let z = 0; z < Chunk.DEPTH; z++) {
                        const worldY = chunk.chunkY * Chunk.HEIGHT + y;
                        if (worldY === 0) continue;

                        const blockId = chunk.getBlock(x, y, z);
                        if (blockId !== 0) {
                            const worldX = chunk.chunkX * Chunk.WIDTH + x;
                            const worldZ = chunk.chunkZ * Chunk.DEPTH + z;
                            positions.push(worldX, worldY, worldZ);
                        }
                    }
                }
            }
        }

        if (positions.length > 0) {
            globalEventBus.emit("PHYSICS_COMMAND", {
                type: 'ADD_TERRAIN_COLLIDERS',
                positions: new Float32Array(positions)
            });
        }
    }

    public removeColliders(blocks: number[][]): void {
        for (const [x, y, z] of blocks) {
            this.removeColliderAt(x, y, z);
        }
    }

    public removeColliderAt(x: number, y: number, z: number): void {
        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'REMOVE_TERRAIN_COLLIDER',
            x: x,
            y: y,
            z: z
        });
    }
}