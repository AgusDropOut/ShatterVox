import { World } from "./World";
import { Chunk } from "./Chunk";

export class TerrainGenerator {
    private world: World;
    private device: GPUDevice;
    private modelLayout: GPUBindGroupLayout;
    
    public debugChunkBorders: boolean = false; 

    constructor(world: World, device: GPUDevice, modelLayout: GPUBindGroupLayout) {
        this.world = world;
        this.device = device;
        this.modelLayout = modelLayout;
    }

    public generateTestMap(): void {
        const CHUNKS_X = 4;
        const CHUNKS_Y = 4; 
        const CHUNKS_Z = 8;

        for (let cx = 0; cx < CHUNKS_X; cx++) {
            for (let cy = 0; cy < CHUNKS_Y; cy++) {
                for (let cz = 0; cz < CHUNKS_Z; cz++) {
                    const chunk = new Chunk(this.device, this.modelLayout, cx, cy, cz);
                    this.world.chunks.set(`${cx},${cy},${cz}`, chunk);
                }
            }
        }

        const WORLD_WIDTH = CHUNKS_X * Chunk.WIDTH;
        const WORLD_HEIGHT = CHUNKS_Y * Chunk.HEIGHT;
        const WORLD_DEPTH = CHUNKS_Z * Chunk.DEPTH;

        const ID_STONE = 1;
        const ID_WOOD = 3;
        const ID_AMETHYST = 5;
        const ID_RUBY = 6;
        const ID_EMERALD = 7;
        const ID_SAPPHIRE = 8;
        const ID_GLOWSTONE = 9;
        
        const GEMS = [ID_AMETHYST, ID_RUBY, ID_EMERALD, ID_SAPPHIRE, ID_GLOWSTONE];

    
        for (let x = 0; x < WORLD_WIDTH; x++) {
            for (let y = 0; y < WORLD_HEIGHT; y++) {
                for (let z = 0; z < WORLD_DEPTH; z++) {
                    let isStone = true;

                 
                    const spineX = (WORLD_WIDTH / 2) + Math.sin(z * 0.05) * 16;
                    const spineY = (WORLD_HEIGHT / 2) - 4 + Math.cos(z * 0.08) * 10;

                    const dx = x - spineX;
                    const dy = y - spineY;
                    
                    const noise = Math.sin(x * 0.2) * Math.cos(y * 0.2) * Math.sin(z * 0.2) * 5;
                    const zRatio = z / WORLD_DEPTH;
                    const cavernBulge = Math.sin(zRatio * Math.PI) * 10; 
                    
                   
                    const radius = 18 + Math.sin(z * 0.08) * 6 + noise + cavernBulge;
                    const distSq = (dx * dx) + (dy * dy * 1.6); // Ovalado en Y

                    if (distSq < radius * radius) {
                        isStone = false; // Espacio abierto
                    }

                  
                    if (y < 4 + Math.sin(x * 0.3 + z * 0.3) * 2) {
                        isStone = true;
                    }
                    if (x < 2 || x >= WORLD_WIDTH - 2 || y < 2 || y >= WORLD_HEIGHT - 2 || z < 2 || z >= WORLD_DEPTH - 2) {
                        isStone = true;
                    }

                    if (isStone) {

                        if (distSq > radius * radius && distSq < (radius + 2.5) * (radius + 2.5) && y > 5) {
                            if (Math.random() < 0.03) {
                                const gemId = GEMS[Math.floor(Math.random() * GEMS.length)];
                                this.world.setBlock(x, y, z, gemId);
                                continue;
                            }
                        }
                        this.world.setBlock(x, y, z, ID_STONE);
                    } else {
  
                        if (y <= 5 && Math.abs(dx) < 6 + noise * 0.5) {
                            if (Math.random() < 0.05) {
                                this.world.setBlock(x, y, z, ID_RUBY);
                            } else if (Math.random() < 0.02) {
                                this.world.setBlock(x, y, z, ID_GLOWSTONE); 
                            } else if (y < 3) {
                                this.world.setBlock(x, y, z, ID_STONE); 
                            }
                        }
                    }
                }
            }
        }


        const pathY = 8;
        for (let z = 4; z < WORLD_DEPTH - 4; z++) {
            const pathX = Math.floor((WORLD_WIDTH / 2) + Math.sin(z * 0.05) * 16);
            
         
            for (let w = -3; w <= 3; w++) {
            
                if (Math.random() > 0.15) {
                    this.world.setBlock(pathX + w, pathY, z, ID_STONE);
                }
            }

            if (z % 8 === 0) {
                const isBroken = Math.random() > 0.8;
                if (!isBroken) {

                    for (let py = 1; py <= 3; py++) {
                        this.world.setBlock(pathX - 3, pathY + py, z, ID_STONE);
                        this.world.setBlock(pathX + 3, pathY + py, z, ID_STONE);
                    }

                    this.world.setBlock(pathX - 3, pathY + 4, z, ID_GLOWSTONE);
                    this.world.setBlock(pathX + 3, pathY + 4, z, ID_GLOWSTONE);
                    
                    this.world.setBlock(pathX, pathY - 1, z, ID_SAPPHIRE);
                }
            }
        }

        const numSpikes = 600; 

        for (let i = 0; i < numSpikes; i++) {
            const x = Math.floor(Math.random() * WORLD_WIDTH);
            const z = Math.floor(Math.random() * WORLD_DEPTH);
            
            let y = WORLD_HEIGHT - 3;
            while (this.world.getBlock(x, y, z) !== 0 && y > 0) y--;
            
            if (y > pathY + 10 && y < WORLD_HEIGHT - 3) {
                const len = 3 + Math.floor(Math.random() * 8);
                const gemId = GEMS[Math.floor(Math.random() * GEMS.length)];
                
                for (let j = 0; j < len; j++) {
                    const blockId = (j >= len - 2) ? gemId : ID_STONE;
                    this.world.setBlock(x, y - j, z, blockId);
                }
            }
        }


        for (let i = 0; i < numSpikes; i++) {
            const x = Math.floor(Math.random() * WORLD_WIDTH);
            const z = Math.floor(Math.random() * WORLD_DEPTH);
            
            let y = 3;
            while (this.world.getBlock(x, y, z) !== 0 && y < WORLD_HEIGHT) y++;
            
            if (y < pathY - 2 && y > 2) {
                const len = 2 + Math.floor(Math.random() * 6);
                const gemId = GEMS[Math.floor(Math.random() * GEMS.length)];
                
                for (let j = 0; j < len; j++) {
                    const blockId = (j >= len - 2) ? gemId : ID_STONE;
                    this.world.setBlock(x, y + j, z, blockId);
                }
            }
        }

  
        for (let i = 0; i < 80; i++) {
            const cx = 2 + Math.floor(Math.random() * (WORLD_WIDTH - 6));
            const cz = 2 + Math.floor(Math.random() * (WORLD_DEPTH - 6));
            
            let cy = 2;
            while (this.world.getBlock(cx, cy, cz) !== 0 && cy < WORLD_HEIGHT) cy++;

            if (cy < pathY + 15) {
               
                for (let bx = 0; bx < 2; bx++) {
                    for (let by = 0; by < 2; by++) {
                        for (let bz = 0; bz < 2; bz++) {
                            this.world.setBlock(cx + bx, cy + by, cz + bz, ID_WOOD);
                        }
                    }
                }
                
                if (Math.random() > 0.6) {
                    this.world.setBlock(cx + 2, cy, cz + 1, ID_AMETHYST);
                }
            }
        }

        if (this.debugChunkBorders) {
            const BORDER_MATERIAL = ID_WOOD; 
            for (let x = 0; x < WORLD_WIDTH; x++) {
                for (let z = 0; z < WORLD_DEPTH; z++) {
                    const isBorderX = (x % Chunk.WIDTH === 0);
                    const isBorderZ = (z % Chunk.DEPTH === 0);
                    if (isBorderX || isBorderZ) {
                        this.world.setBlock(x, 1, z, BORDER_MATERIAL);
                    }
                }
            }
        }
    }
}