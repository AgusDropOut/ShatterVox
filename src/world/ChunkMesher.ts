import { Chunk } from "./Chunk";
import { GeometryGenerator } from "../geometry/GeometryGenerator";
import type { Mesheable } from "../types/Mesheable";

export interface MeshData {
    positions: Float32Array;
    normals: Float32Array;
    colors: Float32Array;
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

export class ChunkMesher {
    

    public buildMesh(center: Mesheable, neighbors: ChunkNeighbors): MeshData {
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];

        // for now I assume that debri and chunk have the same dimensions, but this might change in the future 
        // //TODO: Consider making the dimensions configurable or part of the Mesheable interface.
        for (let x = 0; x < Chunk.WIDTH; x++) {
            for (let y = 0; y < Chunk.HEIGHT; y++) {
                for (let z = 0; z < Chunk.DEPTH; z++) {
                    const blockId = center.getBlock(x, y, z);
                    
                    if (blockId === 0) continue;

                    // Mock RGB fetching (replace with Palette registry later)
                    let r = 1.0, g = 1.0, b = 1.0; 

                    if (blockId === 2) { //debri
                        r = 1.0; 
                        g = 0.0; 
                        b = 0.0;
                    }

                    // +Y (Top)
                    if (this.isTransparent(center, neighbors.top, x, y + 1, z)) {
                        this.addFace(positions, normals, colors, GeometryGenerator.getTopFace(), GeometryGenerator.getTopNormal(), x, y, z, r, g, b);
                    }
                    // -Y (Bottom)
                    if (this.isTransparent(center, neighbors.bottom, x, y - 1, z)) {
                        this.addFace(positions, normals, colors, GeometryGenerator.getBottomFace(), GeometryGenerator.getBottomNormal(), x, y, z, r, g, b);
                    }
                    // +X (Right)
                    if (this.isTransparent(center, neighbors.right, x + 1, y, z)) {
                        this.addFace(positions, normals, colors, GeometryGenerator.getRightFace(), GeometryGenerator.getRightNormal(), x, y, z, r, g, b);
                    }
                    // -X (Left)
                    if (this.isTransparent(center, neighbors.left, x - 1, y, z)) {
                        this.addFace(positions, normals, colors, GeometryGenerator.getLeftFace(), GeometryGenerator.getLeftNormal(), x, y, z, r, g, b);
                    }
                    // +Z (Front)
                    if (this.isTransparent(center, neighbors.front, x, y, z + 1)) {
                        this.addFace(positions, normals, colors, GeometryGenerator.getFrontFace(), GeometryGenerator.getFrontNormal(), x, y, z, r, g, b);
                    }
                    // -Z (Back)
                    if (this.isTransparent(center, neighbors.back, x, y, z - 1)) {
                        this.addFace(positions, normals, colors, GeometryGenerator.getBackFace(), GeometryGenerator.getBackNormal(), x, y, z, r, g, b);
                    }
                }
            }
        }

        return {
            positions: new Float32Array(positions),
            normals: new Float32Array(normals),
            colors: new Float32Array(colors),
            vertexCount: positions.length / 3
        };
    }

  

   
    private addFace(
        posArray: number[], normArray: number[], colArray: number[],
        facePositions: Float32Array, faceNormals: Int8Array,
        x: number, y: number, z: number,
        r: number, g: number, b: number
    ): void {
        const vertexCount = facePositions.length / 3;

        for (let i = 0; i < vertexCount; i++) {
            const idx = i * 3;
 
            posArray.push(
                (facePositions[idx + 0] * 0.5 + 0.5) + x,
                (facePositions[idx + 1] * 0.5 + 0.5) + y,
                (facePositions[idx + 2] * 0.5 + 0.5) + z
            );

            normArray.push(
                faceNormals[idx + 0],
                faceNormals[idx + 1],
                faceNormals[idx + 2]
            );

            colArray.push(r, g, b);
        }
    }


    private isTransparent(center:  Mesheable, neighbor: Mesheable | null, x: number, y: number, z: number): boolean {
        if (x < 0) return neighbor ? neighbor.getBlock(Chunk.WIDTH - 1, y, z) === 0 : true;
        if (x >= Chunk.WIDTH) return neighbor ? neighbor.getBlock(0, y, z) === 0 : true;
        
        if (y < 0) return neighbor ? neighbor.getBlock(x, Chunk.HEIGHT - 1, z) === 0 : true;
        if (y >= Chunk.HEIGHT) return neighbor ? neighbor.getBlock(x, 0, z) === 0 : true;
        
        if (z < 0) return neighbor ? neighbor.getBlock(x, y, Chunk.DEPTH - 1) === 0 : true;
        if (z >= Chunk.DEPTH) return neighbor ? neighbor.getBlock(x, y, 0) === 0 : true;

        return center.getBlock(x, y, z) === 0;
    }
}