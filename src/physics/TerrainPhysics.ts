import { globalEventBus } from "../core/EventBus";
import type { World } from "../world/World";
import { Engine } from "../core/Engine";
import { Chunk } from "../world/Chunk";

export class TerrainPhysics {
    private chunkColliderIds: Map<string, number[]> = new Map();
    private globalIdCounter: number = 1000;

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
    }

    public buildColliders(world: World): void {
        console.time("Physics: Build Colliders");
        for (const [key, chunk] of world.chunks.entries()) {
            this.rebuildChunkColliders(chunk);
        }
        console.timeEnd("Physics: Build Colliders");
    }

    public rebuildChunkColliders(chunk: Chunk): void {
        const key = `${chunk.chunkX},${chunk.chunkY},${chunk.chunkZ}`;
        
        const existingIds = this.chunkColliderIds.get(key);
        if (existingIds) {
            for (let i = 0; i < existingIds.length; i++) {
                globalEventBus.emit("PHYSICS_COMMAND", {
                    type: 'REMOVE_TERRAIN_BOX',
                    id: existingIds[i]
                });
            }
        }

        const boxes = this.computeGreedyMeshingForChunk(chunk);
        const newIds = new Array(boxes.length);
        
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            const newId = this.globalIdCounter++;
            newIds[i] = newId;

            globalEventBus.emit("PHYSICS_COMMAND", {
                type: 'CREATE_STATIC_BOX',
                id: newId,
                halfW: box.halfW,
                halfH: box.halfH,
                halfD: box.halfD,
                x: box.x,
                y: box.y,
                z: box.z
            });
        }

        this.chunkColliderIds.set(key, newIds);
    }

    private computeGreedyMeshingForChunk(chunk: Chunk): { x: number; y: number; z: number; halfW: number; halfH: number; halfD: number }[] {
        const W = Chunk.WIDTH;
        const H = Chunk.HEIGHT;
        const D = Chunk.DEPTH;
        const voxelSize = Engine.voxelSize;

        const volume = W * H * D;
        

        const mask = new Uint8Array(volume);
        let hasBlocks = false;
        
        let i = 0;
        for (let z = 0; z < D; z++) {
            for (let y = 0; y < H; y++) {
                const worldY = chunk.chunkY * H + y;
                const isBedrock = (worldY === 0);
                
                for (let x = 0; x < W; x++) {
                    if (!isBedrock && chunk.getBlock(x, y, z) !== 0) {
                        mask[i] = 1;
                        hasBlocks = true;
                    }
                    i++;
                }
            }
        }

        if (!hasBlocks) return [];

        const boxes: { x: number; y: number; z: number; halfW: number; halfH: number; halfD: number }[] = [];
        

        let idx = 0;
        for (let z = 0; z < D; z++) {
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    idx = x + y * W + z * W * H;

                    if (mask[idx] === 1) {
                        let width = 1;
                        while (x + width < W && mask[idx + width] === 1) {
                            width++;
                        }

                        let height = 1;
                        let doneHeight = false;
                        while (y + height < H && !doneHeight) {
                            for (let wx = 0; wx < width; wx++) {
                                if (mask[idx + wx + height * W] === 0) {
                                    doneHeight = true;
                                    break;
                                }
                            }
                            if (!doneHeight) height++;
                        }

                        let depth = 1;
                        let doneDepth = false;
                        while (z + depth < D && !doneDepth) {
                            for (let hy = 0; hy < height; hy++) {
                                for (let wx = 0; wx < width; wx++) {
                                    if (mask[idx + wx + hy * W + depth * W * H] === 0) {
                                        doneDepth = true;
                                        break;
                                    }
                                }
                                if (doneDepth) break;
                            }
                            if (!doneDepth) depth++;
                        }

                 
                        for (let dz = 0; dz < depth; dz++) {
                            for (let dy = 0; dy < height; dy++) {
                                for (let dx = 0; dx < width; dx++) {
                                    mask[idx + dx + dy * W + dz * W * H] = 0;
                                }
                            }
                        }

                        const worldX = chunk.chunkX * W + x;
                        const worldY = chunk.chunkY * H + y;
                        const worldZ = chunk.chunkZ * D + z;

                        const halfW = (width * voxelSize) / 2;
                        const halfH = (height * voxelSize) / 2;
                        const halfD = (depth * voxelSize) / 2;

                        const centerX = (worldX + width / 2) * voxelSize;
                        const centerY = (worldY + height / 2) * voxelSize;
                        const centerZ = (worldZ + depth / 2) * voxelSize;

                        boxes.push({ x: centerX, y: centerY, z: centerZ, halfW, halfH, halfD });
                    }
                }
            }
        }

        return boxes;
    }
}