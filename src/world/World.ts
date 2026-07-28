import { Chunk } from "./Chunk";
import { ChunkMesher } from "./ChunkMesher";

export class World {
    public readonly chunk: Chunk;
    private readonly mesher: ChunkMesher;

    constructor(gl: WebGL2RenderingContext) {
        this.chunk = new Chunk(gl);
        this.mesher = new ChunkMesher();

        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                for (let z = 0; z < 3; z++) {
                    if(x == 1) break;
                    this.chunk.setBlock(x, y, z, 1);
                }
            }
        }

        this.updateMesh();
    }

    public updateMesh(): void {
        const meshData = this.mesher.buildMesh(this.chunk, {
            top: null, bottom: null, left: null, right: null, front: null, back: null
        });
        this.chunk.updateGraphics(meshData);
    }

    public getBlock(worldX: number, worldY: number, worldZ: number): number {
        // TODO: Map world coordinates to the correct Chunk once we have multiple chunks.
        return this.chunk.getBlock(worldX, worldY, worldZ);
    }
}