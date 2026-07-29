import type { MeshData } from  "../world/ChunkMesher";

export interface Mesheable {
    getBlock(x: number, y: number, z: number): number;
    setBlock(x: number, y: number, z: number, id: number): void;
    updateGraphics(meshData: MeshData): void;
}