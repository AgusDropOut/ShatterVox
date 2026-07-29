import { globalEventBus } from "../core/EventBus";
import { Chunk } from "./Chunk";
import { ChunkMesher } from "./ChunkMesher";
import type { Debri } from "./Debri";

export class World {
    public readonly chunk: Chunk;
    public readonly debri: Debri[];
    private readonly mesher: ChunkMesher;

    constructor(gl: WebGL2RenderingContext) {
        this.chunk = new Chunk(gl);
        this.mesher = new ChunkMesher();
        this.debri = [];
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 16; y++) {
                for (let z = 0; z < 16; z++) {
                    if(x == 1) {
                        this.chunk.setBlock(x, y, z, 1);
                    }
                }
            }
        }

        this.updateMesh();

        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            this.chunk.setBlock(data.x, data.y, data.z, 0);
            this.updateMesh(); 
        });

        globalEventBus.on("BLOCK_MINED_DYNAMIC", (data) => {
            data.debri.setBlock(data.localX, data.localY, data.localZ, 0);
        });
    }

    public updateMesh(): void {
        const meshData = this.mesher.buildMesh(this.chunk, {
            top: null, bottom: null, left: null, right: null, front: null, back: null
        });
        this.chunk.updateGraphics(meshData);

        this.updateDebriMeshes();
    }

    private updateDebriMeshes(): void {
        for (const debri of this.debri) {
            const meshData = this.mesher.buildMesh(debri, {
                top: null, bottom: null, left: null, right: null, front: null, back: null
            });
            debri.updateGraphics(meshData);
        }
    }

    public updateDebriMesh(debri: Debri): void {
        const meshData = this.mesher.buildMesh(debri, {
            top: null, bottom: null, left: null, right: null, front: null, back: null
        });
        debri.updateGraphics(meshData);
    }

    public getBlock(worldX: number, worldY: number, worldZ: number): number {
        // TODO: Map world coordinates to the correct Chunk once we have multiple chunks.
        return this.chunk.getBlock(worldX, worldY, worldZ);
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