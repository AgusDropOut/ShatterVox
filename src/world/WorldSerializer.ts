import { World } from "./World";
import { Chunk } from "./Chunk";
import type { EntityRepository } from "../entity/EntityRepository";
import { BlockRegistry } from "../block/BlockRegistry";
import { Engine } from "../core/Engine";

export class WorldSerializer {
    private static readonly MAGIC_NUMBER = 0x44335643; 
    private static readonly VERSION = 1;

    public static saveWorld(world: World, repository: EntityRepository): Blob {
        const chunkDataBuffers: Uint8Array[] = [];
        let totalChunkDataSize = 0;

        for (const chunk of world.getChunks()) {
            const rleBuffer = this.compressChunkRLE(chunk);
            if (rleBuffer.length === 0) continue; 

            const chunkHeader = new ArrayBuffer(16);
            const view = new DataView(chunkHeader);
            view.setInt32(0, chunk.chunkX, true);
            view.setInt32(4, chunk.chunkY, true);
            view.setInt32(8, chunk.chunkZ, true);
            view.setUint32(12, rleBuffer.byteLength, true);

            const combined = new Uint8Array(16 + rleBuffer.byteLength);
            combined.set(new Uint8Array(chunkHeader), 0);
            combined.set(rleBuffer, 16);

            chunkDataBuffers.push(combined);
            totalChunkDataSize += combined.byteLength;
        }

        const billboardEntities: any[] = [];
        for (const [entityId, renderComp] of repository.renders.entries()) {
            if (renderComp.modelId === "billboard" && renderComp.position && renderComp.rotation) {
                billboardEntities.push({
                    pos: renderComp.position,
                    rot: renderComp.rotation
                });
            }
        }

        const entityDataSize = 4 + (billboardEntities.length * (1 + 12 + 16));
        const entityBuffer = new ArrayBuffer(entityDataSize);
        const entityView = new DataView(entityBuffer);
        
        entityView.setUint32(0, billboardEntities.length, true);
        let offset = 4;
        
        for (const bb of billboardEntities) {
            entityView.setUint8(offset, 1);
            offset += 1;
            entityView.setFloat32(offset, bb.pos[0], true);
            entityView.setFloat32(offset + 4, bb.pos[1], true);
            entityView.setFloat32(offset + 8, bb.pos[2], true);
            offset += 12;
            entityView.setFloat32(offset, bb.rot[0], true);
            entityView.setFloat32(offset + 4, bb.rot[1], true);
            entityView.setFloat32(offset + 8, bb.rot[2], true);
            entityView.setFloat32(offset + 12, bb.rot[3], true);
            offset += 16;
        }

        const headerSize = 9; 
        const finalBuffer = new Uint8Array(headerSize + totalChunkDataSize + entityDataSize);
        const headerView = new DataView(finalBuffer.buffer);

        headerView.setUint32(0, this.MAGIC_NUMBER, true);
        headerView.setUint8(4, this.VERSION);
        headerView.setUint32(5, chunkDataBuffers.length, true);

        let writeOffset = 9;
        for (const cb of chunkDataBuffers) {
            finalBuffer.set(cb, writeOffset);
            writeOffset += cb.byteLength;
        }

        finalBuffer.set(new Uint8Array(entityBuffer), writeOffset);

        return new Blob([finalBuffer], { type: "application/octet-stream" });
    }

    public static loadWorld(buffer: ArrayBuffer, world: World, eventBus: any): boolean {
        const view = new DataView(buffer);
        let offset = 0;

        const magic = view.getUint32(offset, true);
        if (magic !== this.MAGIC_NUMBER) {
            console.error("Invalid world file format.");
            return false;
        }
        offset += 4;

        const version = view.getUint8(offset);
        if (version !== this.VERSION) {
            console.warn("World file version mismatch.");
        }
        offset += 1;

        world.clearChunks();

        const chunkCount = view.getUint32(offset, true);
        offset += 4;

        for (let i = 0; i < chunkCount; i++) {
            const cx = view.getInt32(offset, true);
            const cy = view.getInt32(offset + 4, true);
            const cz = view.getInt32(offset + 8, true);
            const dataSize = view.getUint32(offset + 12, true);
            offset += 16;

            const rleData = new Uint8Array(buffer, offset, dataSize);
            const chunk = world.createChunk(cx, cy, cz);
            this.decompressChunkRLE(chunk, rleData);
            chunk.isDirty = true;
            
            offset += dataSize;
        }

        if (offset < buffer.byteLength) {
            const entityCount = view.getUint32(offset, true);
            offset += 4;

            for (let i = 0; i < entityCount; i++) {
                const type = view.getUint8(offset);
                offset += 1;

                if (type === 1) { 
                    const px = view.getFloat32(offset, true);
                    const py = view.getFloat32(offset + 4, true);
                    const pz = view.getFloat32(offset + 8, true);
                    offset += 12;

                    const rx = view.getFloat32(offset, true);
                    const ry = view.getFloat32(offset + 4, true);
                    const rz = view.getFloat32(offset + 8, true);
                    const rw = view.getFloat32(offset + 12, true);
                    offset += 16;

                    eventBus.emit("SPAWN_BILLBOARD", {
                        x: px, y: py, z: pz,
                        rot: { x: rx, y: ry, z: rz, w: rw }
                    });
                } else {
                    console.warn("Unknown entity type found in save file.");
                }
            }
        }

        
        this.repopulateLights(world, eventBus);

        world.updateAllMeshes();
        return true;
    }

    private static repopulateLights(world: World, eventBus: any): void {
        const s = Engine.voxelSize;

        for (const chunk of world.getChunks()) {
            const blocks = chunk.getRawBlocks();
            const wX = chunk.chunkX * Chunk.WIDTH;
            const wY = chunk.chunkY * Chunk.HEIGHT;
            const wZ = chunk.chunkZ * Chunk.DEPTH;

            for (let x = 0; x < Chunk.WIDTH; x++) {
                for (let y = 0; y < Chunk.HEIGHT; y++) {
                    for (let z = 0; z < Chunk.DEPTH; z++) {
                        const idx = x + Chunk.WIDTH * (y + Chunk.HEIGHT * z);
                        const blockId = blocks[idx];

                        if (blockId === 0) continue;

                        const def = BlockRegistry.get(blockId);
                        if (def && def.lightEmissive && def.lightRadius && def.lightColor) {
                          
                            
                            const globalX = wX + x;
                            const globalY = wY + y;
                            const globalZ = wZ + z;

                            eventBus.emit("LIGHT_ADD", {
                                position: { 
                                    x: (globalX * s) + (s / 2), 
                                    y: (globalY * s) + (s / 2), 
                                    z: (globalZ * s) + (s / 2) 
                                },
                                color: { r: def.lightColor[0], g: def.lightColor[1], b: def.lightColor[2] },
                                radius: def.lightRadius
                            });
                        }
                    }
                }
            }
        }
    }

    private static decompressChunkRLE(chunk: Chunk, rleData: Uint8Array): void {
        const blocks = chunk.getRawBlocks();
        let blockIndex = 0;
        let rleIndex = 0;

        while (rleIndex < rleData.length && blockIndex < blocks.length) {
            const id = rleData[rleIndex++];
            const countHigh = rleData[rleIndex++];
            const countLow = rleData[rleIndex++];
            const count = (countHigh << 8) | countLow;

            for (let c = 0; c < count; c++) {
                if (blockIndex < blocks.length) {
                    blocks[blockIndex++] = id;
                }
            }
        }
    }

    private static compressChunkRLE(chunk: Chunk): Uint8Array {
        const blocks = chunk.getRawBlocks();
        const rle: number[] = [];
        
        let currentId = blocks[0];
        let count = 1;

        for (let i = 1; i < blocks.length; i++) {
            if (blocks[i] === currentId && count < 65535) { 
                count++;
            } else {
                rle.push(currentId);
                rle.push((count & 0xFF00) >> 8); 
                rle.push(count & 0x00FF);        
                
                currentId = blocks[i];
                count = 1;
            }
        }
        
        rle.push(currentId);
        rle.push((count & 0xFF00) >> 8);
        rle.push(count & 0x00FF);

        return new Uint8Array(rle);
    }
}