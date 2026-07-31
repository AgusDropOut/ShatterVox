import { Chunk } from "./Chunk";
import { GeometryGenerator } from "../geometry/GeometryGenerator";
import type { Mesheable } from "../types/Mesheable";
import { Engine } from "../core/Engine";

export interface MeshData {
    positions: Float32Array;
    normals: Float32Array;
    colors: Float32Array;
    uvs: Float32Array;
    vertexCount: number;
}

export interface ChunkNeighbors {
    top: Mesheable | null;
    bottom: Mesheable | null;
    left: Mesheable | null;
    right: Mesheable | null;
    front: Mesheable | null;
    back: Mesheable | null;
}

const ATLAS_SIZE = 16;
const TILE_SIZE = 1.0 / ATLAS_SIZE;

export class ChunkMesher {
    public buildMesh(center: Mesheable, neighbors: ChunkNeighbors, offX: number = 0, offY: number = 0, offZ: number = 0): MeshData {
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const uvs: number[] = [];

        for (let x = 0; x < Chunk.WIDTH; x++) {
            for (let y = 0; y < Chunk.HEIGHT; y++) {
                for (let z = 0; z < Chunk.DEPTH; z++) {
                    const blockId = center.getBlock(x, y, z);
                    
                    if (blockId === 0) continue;
                    let r = 1.0, g = 1.0, b = 1.0; 

                

                    const tileX = blockId % ATLAS_SIZE;
                    const tileY = Math.floor(blockId / ATLAS_SIZE);

                    if (this.isTransparent(center, neighbors.top, x, y + 1, z)) {
                        this.addFace(positions, normals, colors, uvs, GeometryGenerator.getTopFace(), GeometryGenerator.getTopNormal(), x, y, z, r, g, b, tileX, tileY, offX, offY, offZ);
                    }
                    if (this.isTransparent(center, neighbors.bottom, x, y - 1, z)) {
                        this.addFace(positions, normals, colors, uvs, GeometryGenerator.getBottomFace(), GeometryGenerator.getBottomNormal(), x, y, z, r, g, b, tileX, tileY, offX, offY, offZ);
                    }
                    if (this.isTransparent(center, neighbors.right, x + 1, y, z)) {
                        this.addFace(positions, normals, colors, uvs, GeometryGenerator.getRightFace(), GeometryGenerator.getRightNormal(), x, y, z, r, g, b, tileX, tileY, offX, offY, offZ);
                    }
                    if (this.isTransparent(center, neighbors.left, x - 1, y, z)) {
                        this.addFace(positions, normals, colors, uvs, GeometryGenerator.getLeftFace(), GeometryGenerator.getLeftNormal(), x, y, z, r, g, b, tileX, tileY, offX, offY, offZ);
                    }
                    if (this.isTransparent(center, neighbors.front, x, y, z + 1)) {
                        this.addFace(positions, normals, colors, uvs, GeometryGenerator.getFrontFace(), GeometryGenerator.getFrontNormal(), x, y, z, r, g, b, tileX, tileY, offX, offY, offZ);
                    }
                    if (this.isTransparent(center, neighbors.back, x, y, z - 1)) {
                        this.addFace(positions, normals, colors, uvs, GeometryGenerator.getBackFace(), GeometryGenerator.getBackNormal(), x, y, z, r, g, b, tileX, tileY, offX, offY, offZ);
                    }
                }
            }
        }

        return {
            positions: new Float32Array(positions),
            normals: new Float32Array(normals),
            colors: new Float32Array(colors),
            uvs: new Float32Array(uvs),
            vertexCount: positions.length / 3
        };
    }

    private addFace(
        posArray: number[], normArray: number[], colArray: number[], uvArray: number[],
        facePositions: Float32Array, faceNormals: Int8Array,
        x: number, y: number, z: number,
        r: number, g: number, b: number,
        tileX: number, tileY: number,
        offX: number, offY: number, offZ: number 
    ): void {
        const vertexCount = facePositions.length / 3;

        const faceUvs = [
            0, 0,
            1, 0,
            1, 1,
            1, 1,
            0, 1,
            0, 0
        ];

        for (let i = 0; i < vertexCount; i++) {
            const idx = i * 3;
            const uvIdx = i * 2;

            posArray.push(
                (facePositions[idx + 0] * 0.5 + 0.5 + x + offX) * Engine.voxelSize,
                (facePositions[idx + 1] * 0.5 + 0.5 + y + offY) * Engine.voxelSize,
                (facePositions[idx + 2] * 0.5 + 0.5 + z + offZ) * Engine.voxelSize
            );

            normArray.push(
                faceNormals[idx + 0],
                faceNormals[idx + 1],
                faceNormals[idx + 2]
            );

            colArray.push(r, g, b);

            const u = (tileX + faceUvs[uvIdx + 0]) * TILE_SIZE;
            const v = (tileY + faceUvs[uvIdx + 1]) * TILE_SIZE;
            
            uvArray.push(u, v);
        }
    }

    private isTransparent(center: Mesheable, neighbor: Mesheable | null, x: number, y: number, z: number): boolean {
        if (x < 0) return neighbor ? neighbor.getBlock(Chunk.WIDTH - 1, y, z) === 0 : true;
        if (x >= Chunk.WIDTH) return neighbor ? neighbor.getBlock(0, y, z) === 0 : true;
        
        if (y < 0) return neighbor ? neighbor.getBlock(x, Chunk.HEIGHT - 1, z) === 0 : true;
        if (y >= Chunk.HEIGHT) return neighbor ? neighbor.getBlock(x, 0, z) === 0 : true;
        
        if (z < 0) return neighbor ? neighbor.getBlock(x, y, Chunk.DEPTH - 1) === 0 : true;
        if (z >= Chunk.DEPTH) return neighbor ? neighbor.getBlock(x, y, 0) === 0 : true;

        return center.getBlock(x, y, z) === 0;
    }
}