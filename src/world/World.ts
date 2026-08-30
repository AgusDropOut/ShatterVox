import type { TerrainPhysics } from "../physics/TerrainPhysics";
import { Chunk } from "./Chunk";
import { ChunkMesher } from "./ChunkMesher";
import type { Debri } from "./Debri";
import { TerrainGenerator } from "./TerrainGenerator";

export class World {
    public readonly chunks: Map<string, Chunk> = new Map();
    public readonly debri: Debri[];
    private readonly mesher: ChunkMesher;
    private readonly device: GPUDevice;
    public terrainPhysics: TerrainPhysics | null = null;

    constructor(device: GPUDevice, modelLayout: GPUBindGroupLayout, terrainPhysics: TerrainPhysics | null = null) {
        this.mesher = new ChunkMesher();
        this.debri = [];
        this.device = device;
        this.terrainPhysics = terrainPhysics;

        const generator = new TerrainGenerator(this, device, modelLayout);
        generator.generateTestMap();
        
        this.updateAllMeshes();
    }
    
    public getBlock(worldX: number, worldY: number, worldZ: number): number {
        const cx = Math.floor(worldX / Chunk.WIDTH);
        const cy = Math.floor(worldY / Chunk.HEIGHT);
        const cz = Math.floor(worldZ / Chunk.DEPTH);
        
        const chunk = this.chunks.get(`${cx},${cy},${cz}`);
        if (!chunk) return 0; 
        
        const lx = ((worldX % Chunk.WIDTH) + Chunk.WIDTH) % Chunk.WIDTH;
        const ly = ((worldY % Chunk.HEIGHT) + Chunk.HEIGHT) % Chunk.HEIGHT;
        const lz = ((worldZ % Chunk.DEPTH) + Chunk.DEPTH) % Chunk.DEPTH;

        return chunk.getBlock(lx, ly, lz);
    }

    public setBlock(worldX: number, worldY: number, worldZ: number, id: number): void {
        const cx = Math.floor(worldX / Chunk.WIDTH);
        const cy = Math.floor(worldY / Chunk.HEIGHT);
        const cz = Math.floor(worldZ / Chunk.DEPTH);
        
        const chunk = this.chunks.get(`${cx},${cy},${cz}`);
        if (!chunk) return; 

        const lx = ((worldX % Chunk.WIDTH) + Chunk.WIDTH) % Chunk.WIDTH;
        const ly = ((worldY % Chunk.HEIGHT) + Chunk.HEIGHT) % Chunk.HEIGHT;
        const lz = ((worldZ % Chunk.DEPTH) + Chunk.DEPTH) % Chunk.DEPTH;

        chunk.setBlock(lx, ly, lz, id);
    }

    
    public setChunkDirtyAt(worldX: number, worldY: number, worldZ: number): void {
        const cx = Math.floor(worldX / Chunk.WIDTH);
        const cy = Math.floor(worldY / Chunk.HEIGHT);
        const cz = Math.floor(worldZ / Chunk.DEPTH);
        
        const chunk = this.chunks.get(`${cx},${cy},${cz}`);
        if (chunk) chunk.isDirty = true;

        
        const modX = ((worldX % Chunk.WIDTH) + Chunk.WIDTH) % Chunk.WIDTH;
        const modY = ((worldY % Chunk.HEIGHT) + Chunk.HEIGHT) % Chunk.HEIGHT;
        const modZ = ((worldZ % Chunk.DEPTH) + Chunk.DEPTH) % Chunk.DEPTH;

        if (modX === 0) {
            const neighbor = this.chunks.get(`${cx - 1},${cy},${cz}`);
            if (neighbor) neighbor.isDirty = true;
        } else if (modX === Chunk.WIDTH - 1) {
            const neighbor = this.chunks.get(`${cx + 1},${cy},${cz}`);
            if (neighbor) neighbor.isDirty = true;
        }

        if (modY === 0) {
            const neighbor = this.chunks.get(`${cx},${cy - 1},${cz}`);
            if (neighbor) neighbor.isDirty = true;
        } else if (modY === Chunk.HEIGHT - 1) {
            const neighbor = this.chunks.get(`${cx},${cy + 1},${cz}`);
            if (neighbor) neighbor.isDirty = true;
        }

        if (modZ === 0) {
            const neighbor = this.chunks.get(`${cx},${cy},${cz - 1}`);
            if (neighbor) neighbor.isDirty = true;
        } else if (modZ === Chunk.DEPTH - 1) {
            const neighbor = this.chunks.get(`${cx},${cy},${cz + 1}`);
            if (neighbor) neighbor.isDirty = true;
        }
    }

  
    public updateDirtyMeshes(): void {
        for (const chunk of this.chunks.values()) {
            if (chunk.isDirty) {
                this.updateChunkMesh(chunk);
                if (this.terrainPhysics) {
                    this.terrainPhysics.rebuildChunkColliders(chunk);
                }
                console.log(`Updated mesh for dirty chunk at (${chunk.chunkX}, ${chunk.chunkY}, ${chunk.chunkZ})`);
                chunk.isDirty = false;
            }
        }
    }
  
    public updateAllMeshes(): void {
        for (const chunk of this.chunks.values()) {
            this.updateChunkMesh(chunk);
            if (this.terrainPhysics) {
                this.terrainPhysics.rebuildChunkColliders(chunk);
            }
        }  
        for (const debri of this.debri) {
            this.updateDebriMesh(debri);
        }
    }

    private updateChunkMesh(chunk: Chunk): void {
        let neighbors = {
            top: this.chunks.get(`${chunk.chunkX},${chunk.chunkY + 1},${chunk.chunkZ}`) || null,
            bottom: this.chunks.get(`${chunk.chunkX},${chunk.chunkY - 1},${chunk.chunkZ}`) || null,
            left: this.chunks.get(`${chunk.chunkX - 1},${chunk.chunkY},${chunk.chunkZ}`) || null,
            right: this.chunks.get(`${chunk.chunkX + 1},${chunk.chunkY},${chunk.chunkZ}`) || null,
            front: this.chunks.get(`${chunk.chunkX},${chunk.chunkY},${chunk.chunkZ + 1}`) || null,
            back: this.chunks.get(`${chunk.chunkX},${chunk.chunkY},${chunk.chunkZ - 1}`) || null
        };

        const meshData = this.mesher.buildMesh(
            chunk, 
            neighbors,
            chunk.chunkX * Chunk.WIDTH,
            chunk.chunkY * Chunk.HEIGHT,
            chunk.chunkZ * Chunk.DEPTH
        );
        chunk.updateGraphics(this.device, meshData);
    }

    public updateDebriMesh(debri: Debri): void {
        const meshData = this.mesher.buildMesh(debri, {
            top: null, bottom: null, left: null, right: null, front: null, back: null
        });
        debri.updateGraphics(this.device, meshData);
    }

    public addDebri(debri: Debri): void {
        this.debri.push(debri);
    }

    public removeDebri(debri: Debri): void {
        const index = this.debri.indexOf(debri);
        if (index !== -1) {
            this.debri.splice(index, 1);
        }
    }
}