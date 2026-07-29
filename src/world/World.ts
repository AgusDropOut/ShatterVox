import { globalEventBus } from "../core/EventBus";
import { Chunk } from "./Chunk";
import { ChunkMesher } from "./ChunkMesher";
import type { Debri } from "./Debri";

export class World {

    public readonly chunks: Map<string, Chunk> = new Map();
    public readonly debri: Debri[];
    private readonly mesher: ChunkMesher;

    constructor(gl: WebGL2RenderingContext) {
        this.mesher = new ChunkMesher();
        this.debri = [];
        
    
        this.generateTestMap(gl);

        this.updateAllMeshes();

      
        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            this.setBlock(data.x, data.y, data.z, 0);
            this.updateChunkMeshAt(data.x, data.y, data.z); 
        });

        globalEventBus.on("BLOCK_MINED_DYNAMIC", (data) => {
            data.debri.setBlock(data.localX, data.localY, data.localZ, 0);
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
        for (const chunk of this.chunks.values()) {
            this.updateChunkMesh(chunk);
        }
        this.updateDebriMeshes();
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
        const meshData = this.mesher.buildMesh(
            chunk, 
            { top: null, bottom: null, left: null, right: null, front: null, back: null },
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

    private generateTestMap(gl: WebGL2RenderingContext): void {
        for (let cx = 0; cx < 2; cx++) {
            for (let cz = 0; cz < 2; cz++) {
                const chunk = new Chunk(gl, cx, 0, cz);
                this.chunks.set(`${cx},0,${cz}`, chunk);
                
           
                for (let x = 0; x < 16; x++) {
                    for (let z = 0; z < 16; z++) {
                        chunk.setBlock(x, 0, z, 1);
                    }
                }
            }
        }
        
  

  
        this.setBlock(15, 1, 15, 1);
        this.setBlock(15, 2, 15, 1);
        this.setBlock(15, 3, 15, 1);


        for (let y = 1; y <= 4; y++) {
            this.setBlock(5, y, 5, 1);
        }
        for (let x = 4; x <= 6; x++) {
            for (let y = 4; y <= 5; y++) {
                for (let z = 4; z <= 6; z++) {
                    this.setBlock(x, y, z, 1);
                }
            }
        }


        for (let y = 1; y <= 4; y++) {
            this.setBlock(10, y, 20, 1);
            this.setBlock(11, y, 20, 1);
        }

        for (let y = 1; y <= 4; y++) {
            this.setBlock(18, y, 20, 1);
            this.setBlock(19, y, 20, 1);
        }

        for (let x = 10; x <= 19; x++) {
            this.setBlock(x, 4, 20, 1);
            this.setBlock(x, 5, 20, 1);
        }


        for (let x = 25; x <= 29; x++) {
            for (let z = 5; z <= 9; z++) {
                this.setBlock(x, 3, z, 1);
            }
        }
      
        this.setBlock(27, 1, 7, 1);
        this.setBlock(27, 2, 7, 1);
    }
}