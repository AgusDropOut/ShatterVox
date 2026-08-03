import { World } from "./World";
import { Chunk } from "./Chunk";

export class TerrainGenerator {
    private world: World;
    private gl: WebGL2RenderingContext;
    
    public debugChunkBorders: boolean = true; 

    constructor(world: World, gl: WebGL2RenderingContext) {
        this.world = world;
        this.gl = gl;
    }

    public generateTestMap(): void {
        const CHUNKS_X = 4;
        const CHUNKS_Y = 2; 
        const CHUNKS_Z = 4;

        for (let cx = 0; cx < CHUNKS_X; cx++) {
            for (let cy = 0; cy < CHUNKS_Y; cy++) {
                for (let cz = 0; cz < CHUNKS_Z; cz++) {
                    const chunk = new Chunk(this.gl, cx, cy, cz);
                    this.world.chunks.set(`${cx},${cy},${cz}`, chunk);
                }
            }
        }

        const WORLD_WIDTH = CHUNKS_X * Chunk.WIDTH;
        const WORLD_DEPTH = CHUNKS_Z * Chunk.DEPTH;

        const ID_STONE = 1;
        const ID_GRASS = 2;
        const ID_WOOD = 3;
        const ID_LEAVES = 4;

        for (let x = 0; x < WORLD_WIDTH; x++) {
            for (let z = 0; z < WORLD_DEPTH; z++) {
                this.world.setBlock(x, 0, z, ID_GRASS);
                if (Math.random() > 0.99) {
                    this.world.setBlock(x, 1, z, ID_GRASS);
                }
            }
        }

        const templeX = 40, templeZ = 40, templeY = 1; 
        const templeWidth = 40, templeDepth = 26;

        for (let x = templeX; x < templeX + templeWidth; x++) {
            for (let z = templeZ; z < templeZ + templeDepth; z++) {
                this.world.setBlock(x, templeY, z, ID_STONE);
                this.world.setBlock(x, templeY + 1, z, ID_STONE);
                this.world.setBlock(x, templeY + 2, z, ID_STONE); 
            }
        }

        const columnSpacing = 8;
        for (let x = templeX + 3; x < templeX + templeWidth - 3; x += columnSpacing) {
            for (let z of [templeZ + 3, templeZ + templeDepth - 6]) {
                for (let y = templeY + 3; y < templeY + 18; y++) {
                    for(let cx = 0; cx < 3; cx++) {
                        for(let cz = 0; cz < 3; cz++) {
                            this.world.setBlock(x + cx, y, z + cz, ID_STONE);
                        }
                    }
                }
            }
        }

        for (let x = templeX - 2; x < templeX + templeWidth + 2; x++) {
            for (let z = templeZ - 2; z < templeZ + templeDepth + 2; z++) {
                this.world.setBlock(x, templeY + 18, z, ID_STONE);
                this.world.setBlock(x, templeY + 19, z, ID_STONE);
                this.world.setBlock(x, templeY + 20, z, ID_STONE);
                
                if (x > templeX + 2 && x < templeX + templeWidth - 2) {
                    this.world.setBlock(x, templeY + 21, z, ID_STONE);
                    this.world.setBlock(x, templeY + 22, z, ID_STONE);
                    if (z > templeZ + 6 && z < templeZ + templeDepth - 6) {
                        this.world.setBlock(x, templeY + 23, z, ID_STONE);
                    }
                }
            }
        }

    
        const treeX = 90, treeZ = 90;
        const treeBaseY = 1; 

        for (let y = treeBaseY; y < treeBaseY + 20; y++) {
            for (let x = treeX - 2; x <= treeX + 2; x++) {
                for (let z = treeZ - 2; z <= treeZ + 2; z++) {
                    if (Math.random() > 0.05) this.world.setBlock(x, y, z, ID_WOOD);
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
                        this.world.setBlock(x, y, z, ID_LEAVES);
                    }
                }
            }
        }

  
        const archX = 15, archZ = 90, archY = 1;
        for (let i = 0; i < 15; i++) { 
            this.world.setBlock(archX, archY + i, archZ, ID_STONE);
            this.world.setBlock(archX + 1, archY + i, archZ, ID_STONE);
        }
        for (let i = 0; i < 15; i++) { 
            this.world.setBlock(archX + 16, archY + i, archZ, ID_STONE);
            this.world.setBlock(archX + 17, archY + i, archZ, ID_STONE);
        }
        for (let i = 0; i <= 16; i++) { 
            if (i < 6 || i > 10) { 
                this.world.setBlock(archX + i, archY + 14, archZ, ID_STONE);
                this.world.setBlock(archX + i, archY + 15, archZ, ID_STONE);
            }
        }

        if (this.debugChunkBorders) {

            const BORDER_MATERIAL = ID_WOOD; 

            for (let x = 0; x < WORLD_WIDTH; x++) {
                for (let z = 0; z < WORLD_DEPTH; z++) {

                    const isBorderX = (x % Chunk.WIDTH === 0);
                    const isBorderZ = (z % Chunk.DEPTH === 0);

                    if (isBorderX || isBorderZ) {
                        this.world.setBlock(x, 0, z, BORDER_MATERIAL);
                        this.world.setBlock(x, 1, z, 0); 
                    }
                }
            }
        }
    }
}