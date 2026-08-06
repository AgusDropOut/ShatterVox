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
        for (const [key, chunk] of world.chunks.entries()) {
            this.rebuildChunkColliders(chunk);
        }
    }

    public rebuildChunkColliders(chunk: Chunk): void {
        const key = `${chunk.chunkX},${chunk.chunkY},${chunk.chunkZ}`;
        
        const existingIds = this.chunkColliderIds.get(key);
        if (existingIds) {
            for (const id of existingIds) {
                globalEventBus.emit("PHYSICS_COMMAND", {
                    type: 'REMOVE_TERRAIN_BOX',
                    id: id
                });
            }
        }

        const boxes = this.computeGreedyMeshingForChunk(chunk);
        const newIds: number[] = [];
        for (const box of boxes) {
            const newId = this.globalIdCounter++;
            newIds.push(newId);

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
        const voxels = new Uint8Array(volume);
        
        let hasBlocks = false;
        for (let x = 0; x < W; x++) {
            for (let y = 0; y < H; y++) {
                for (let z = 0; z < D; z++) {
                    const worldY = chunk.chunkY * H + y;
                    if (worldY === 0) continue; 

                    const id = chunk.getBlock(x, y, z);
                    const idx = x + (y * W) + (z * W * H);
                    if (id !== 0) {
                        voxels[idx] = 1;
                        hasBlocks = true;
                    }
                }
            }
        }

        if (!hasBlocks) return [];

        const boxes: { x: number; y: number; z: number; halfW: number; halfH: number; halfD: number }[] = [];
        const visited = new Uint8Array(volume);

        for (let z = 0; z < D; z++) {
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const idx = x + (y * W) + (z * W * H);
                    if (voxels[idx] === 0 || visited[idx] === 1) continue;

                    let width = 0;
                    while (x + width < W) {
                        const nIdx = (x + width) + (y * W) + (z * W * H);
                        if (voxels[nIdx] === 0 || visited[nIdx] === 1) break;
                        width++;
                    }

                    let depth = 1;
                    let canExpandZ = true;
                    while (z + depth < D && canExpandZ) {
                        for (let wx = 0; wx < width; wx++) {
                            const checkIdx = (x + wx) + (y * W) + ((z + depth) * W * H);
                            if (voxels[checkIdx] === 0 || visited[checkIdx] === 1) {
                                canExpandZ = false;
                                break;
                            }
                        }
                        if (canExpandZ) depth++;
                    }

                    let height = 1;
                    let canExpandY = true;
                    while (y + height < H && canExpandY) {
                        for (let wz = 0; wz < depth; wz++) {
                            for (let wx = 0; wx < width; wx++) {
                                const checkIdx = (x + wx) + ((y + height) * W) + ((z + wz) * W * H);
                                if (voxels[checkIdx] === 0 || visited[checkIdx] === 1) {
                                    canExpandY = false;
                                    break;
                                }
                            }
                            if (!canExpandY) break;
                        }
                        if (canExpandY) height++;
                    }

                    for (let wy = 0; wy < height; wy++) {
                        for (let wz = 0; wz < depth; wz++) {
                            for (let wx = 0; wx < width; wx++) {
                                const markIdx = (x + wx) + ((y + wy) * W) + ((z + wz) * W * H);
                                visited[markIdx] = 1;
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

        return boxes;
    }
}