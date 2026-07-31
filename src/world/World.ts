import { globalEventBus } from "../core/EventBus";
import { Chunk } from "./Chunk";
import { ChunkMesher } from "./ChunkMesher";
import type { Debri } from "./Debri";
import { TerrainGenerator } from "./TerrainGenerator";

export class World {

    public readonly chunks: Map<string, Chunk> = new Map();
    public readonly debri: Debri[];
    private readonly mesher: ChunkMesher;

    constructor(gl: WebGL2RenderingContext) {
        this.mesher = new ChunkMesher();
        this.debri = [];
        const generator = new TerrainGenerator(this, gl);
        generator.generateTestMap();
      
        this.updateAllMeshes();

        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            this.setBlock(data.x, data.y, data.z, 0);
            this.updateChunkMeshAt(data.x, data.y, data.z); 
        });

        globalEventBus.on("BLOCK_MINED_DYNAMIC", (data) => {
            const debri = this.debri.find(d => d.id === data.debriId);
            if (debri) {
                debri.setBlock(data.localX, data.localY, data.localZ, 0);
                this.updateDebriMesh(debri);
            }
        });
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

  
    public updateAllMeshes(): void {
        this.updateChunkMeshes();
        this.updateDebriMeshes();
    }

    public updateChunkMeshes(): void {
        for (const chunk of this.chunks.values()) {
            this.updateChunkMesh(chunk);
        }  
    }

  
    public updateChunkMeshAt(worldX: number, worldY: number, worldZ: number): void {
        const cx = Math.floor(worldX / Chunk.WIDTH);
        const cy = Math.floor(worldY / Chunk.HEIGHT);
        const cz = Math.floor(worldZ / Chunk.DEPTH);
        const chunk = this.chunks.get(`${cx},${cy},${cz}`);
        
        if (chunk) {
            this.updateChunkMesh(chunk);
        }
    }

    private updateChunkMesh(chunk: Chunk): void {
        let neighbors: { top: Chunk | null; bottom: Chunk | null; left: Chunk | null; right: Chunk | null; front: Chunk | null; back: Chunk | null } = {
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
        chunk.updateGraphics(meshData);
    }

    private updateDebriMeshes(): void {
        for (const debri of this.debri) {
            this.updateDebriMesh(debri);
        }
    }

    public updateDebriMesh(debri: Debri): void {
        const meshData = this.mesher.buildMesh(debri, {
            top: null, bottom: null, left: null, right: null, front: null, back: null
        });
        debri.updateGraphics(meshData);
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