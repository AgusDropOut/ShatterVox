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
        const CHUNKS_X = 4;
        const CHUNKS_Y = 2; 
        const CHUNKS_Z = 4;

        for (let cx = 0; cx < CHUNKS_X; cx++) {
            for (let cy = 0; cy < CHUNKS_Y; cy++) {
                for (let cz = 0; cz < CHUNKS_Z; cz++) {
                    const chunk = new Chunk(gl, cx, cy, cz);
                    this.chunks.set(`${cx},${cy},${cz}`, chunk);
                }
            }
        }

        const WORLD_WIDTH = CHUNKS_X * Chunk.WIDTH;
        const WORLD_DEPTH = CHUNKS_Z * Chunk.DEPTH;

      
        for (let x = 0; x < WORLD_WIDTH; x++) {
            for (let z = 0; z < WORLD_DEPTH; z++) {
                this.setBlock(x, 0, z, 1);
                
             
                if (Math.random() > 0.99) {
                    this.setBlock(x, 1, z, 1);
                }
            }
        }

       
        const templeX = 40, templeZ = 40, templeY = 1; 
        const templeWidth = 40, templeDepth = 26;

        for (let x = templeX; x < templeX + templeWidth; x++) {
            for (let z = templeZ; z < templeZ + templeDepth; z++) {
                this.setBlock(x, templeY, z, 1);
                this.setBlock(x, templeY + 1, z, 1);
                this.setBlock(x, templeY + 2, z, 1); 
            }
        }

        const columnSpacing = 8;
        for (let x = templeX + 3; x < templeX + templeWidth - 3; x += columnSpacing) {
            for (let z of [templeZ + 3, templeZ + templeDepth - 6]) {
                for (let y = templeY + 3; y < templeY + 18; y++) {
                    for(let cx = 0; cx < 3; cx++) {
                        for(let cz = 0; cz < 3; cz++) {
                            this.setBlock(x + cx, y, z + cz, 1);
                        }
                    }
                }
            }
        }

        for (let x = templeX - 2; x < templeX + templeWidth + 2; x++) {
            for (let z = templeZ - 2; z < templeZ + templeDepth + 2; z++) {
                this.setBlock(x, templeY + 18, z, 1);
                this.setBlock(x, templeY + 19, z, 1);
                this.setBlock(x, templeY + 20, z, 1);
                
                if (x > templeX + 2 && x < templeX + templeWidth - 2) {
                    this.setBlock(x, templeY + 21, z, 1);
                    this.setBlock(x, templeY + 22, z, 1);
                    if (z > templeZ + 6 && z < templeZ + templeDepth - 6) {
                        this.setBlock(x, templeY + 23, z, 1);
                    }
                }
            }
        }

       
        const treeX = 90, treeZ = 90;
        const treeBaseY = 1; 

        for (let y = treeBaseY; y < treeBaseY + 20; y++) {
            for (let x = treeX - 2; x <= treeX + 2; x++) {
                for (let z = treeZ - 2; z <= treeZ + 2; z++) {
                    if (Math.random() > 0.05) this.setBlock(x, y, z, 1);
                }
            }
        }

        const radius = 12;
        const canopyCenterY = treeBaseY + 22;
        for (let x = treeX - radius; x <= treeX + radius; x++) {
            for (let y = canopyCenterY - radius; y <= canopyCenterY + radius; y++) {
                for (let z = treeZ - radius; z <= treeZ + radius; z++) {
                    const dx = x - treeX;
                    const dy = y - canopyCenterY;
                    const dz = z - treeZ;
                    if (dx*dx + dy*dy + dz*dz <= radius*radius - Math.random() * 8) {
                        this.setBlock(x, y, z, 1);
                    }
                }
            }
        }

   
        const archX = 15, archZ = 90, archY = 1;
        for (let i = 0; i < 15; i++) { 
            this.setBlock(archX, archY + i, archZ, 1);
            this.setBlock(archX + 1, archY + i, archZ, 1);
        }
        for (let i = 0; i < 15; i++) { 
            this.setBlock(archX + 16, archY + i, archZ, 1);
            this.setBlock(archX + 17, archY + i, archZ, 1);
        }
        for (let i = 0; i <= 16; i++) { 
            if (i < 6 || i > 10) { 
                this.setBlock(archX + i, archY + 14, archZ, 1);
                this.setBlock(archX + i, archY + 15, archZ, 1);
            }
        }
    }
}