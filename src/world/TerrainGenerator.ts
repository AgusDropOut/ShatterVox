import { World } from "./World";
import { Chunk } from "./Chunk";

export type LightMode = 'RANDOM' | 'SINGLE_COLOR' | 'CLUSTERED';

export class TerrainGenerator {
    private world: World;
    private device: GPUDevice;
    private modelLayout: GPUBindGroupLayout;
    
  
    public debugChunkBorders: boolean = false; 
    
    
    public lightMode: LightMode = 'RANDOM';
    
  
    
    
    
    public clusterScale: number = 0.05;
   

   
    public static readonly ID_STONE = 1;
    public static readonly ID_WOOD = 3;
    public static readonly ID_AMETHYST = 5;
    public static readonly ID_RUBY = 6;
    public static readonly ID_EMERALD = 7;
    public static readonly ID_SAPPHIRE = 8;
    public static readonly ID_GLOWSTONE = 9;

    public singleLightColorId: number = TerrainGenerator.ID_AMETHYST; 

    private readonly LIGHT_BLOCKS = [
        TerrainGenerator.ID_AMETHYST, 
        TerrainGenerator.ID_RUBY, 
        TerrainGenerator.ID_EMERALD, 
        TerrainGenerator.ID_SAPPHIRE, 
        TerrainGenerator.ID_GLOWSTONE
    ];

    constructor(world: World, device: GPUDevice, modelLayout: GPUBindGroupLayout) {
        this.world = world;
        this.device = device;
        this.modelLayout = modelLayout;
    }

    
    private getLightBlockId(x: number, y: number, z: number): number {
        if (this.lightMode === 'SINGLE_COLOR') {
            return this.singleLightColorId;
        }

        if (this.lightMode === 'CLUSTERED') {
          
            const noise = Math.sin(x * this.clusterScale) + 
                          Math.cos(y * this.clusterScale) + 
                          Math.sin(z * this.clusterScale);
            
          
            const normalized = (noise + 3) / 6; 
            
           
            let index = Math.floor(normalized * this.LIGHT_BLOCKS.length);
            index = Math.max(0, Math.min(this.LIGHT_BLOCKS.length - 1, index));
            
            return this.LIGHT_BLOCKS[index];
        }

        return this.LIGHT_BLOCKS[Math.floor(Math.random() * this.LIGHT_BLOCKS.length)];
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
                    const distSq = (dx * dx) + (dy * dy * 1.6);

                    if (distSq < radius * radius) {
                        isStone = false; 
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
                                this.world.setBlock(x, y, z, this.getLightBlockId(x, y, z));
                                continue;
                            }
                        }
                        this.world.setBlock(x, y, z, TerrainGenerator.ID_STONE);
                    } else {
                        if (y <= 5 && Math.abs(dx) < 6 + noise * 0.5) {
                        
                            if (Math.random() < 0.07) {
                                this.world.setBlock(x, y, z, this.getLightBlockId(x, y, z));
                            } else if (y < 3) {
                                this.world.setBlock(x, y, z, TerrainGenerator.ID_STONE); 
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
                    this.world.setBlock(pathX + w, pathY, z, TerrainGenerator.ID_STONE);
                }
            }

            if (z % 8 === 0) {
                const isBroken = Math.random() > 0.8;
                if (!isBroken) {
                    for (let py = 1; py <= 3; py++) {
                        this.world.setBlock(pathX - 3, pathY + py, z, TerrainGenerator.ID_STONE);
                        this.world.setBlock(pathX + 3, pathY + py, z, TerrainGenerator.ID_STONE);
                    }

                 
                    this.world.setBlock(pathX - 3, pathY + 4, z, this.getLightBlockId(pathX - 3, pathY + 4, z));
                    this.world.setBlock(pathX + 3, pathY + 4, z, this.getLightBlockId(pathX + 3, pathY + 4, z));
                    this.world.setBlock(pathX, pathY - 1, z, this.getLightBlockId(pathX, pathY - 1, z));
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
                const lightId = this.getLightBlockId(x, y, z);
                
                for (let j = 0; j < len; j++) {
                    const blockId = (j >= len - 2) ? lightId : TerrainGenerator.ID_STONE;
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
                const lightId = this.getLightBlockId(x, y, z);
                
                for (let j = 0; j < len; j++) {
                    const blockId = (j >= len - 2) ? lightId : TerrainGenerator.ID_STONE;
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
                            this.world.setBlock(cx + bx, cy + by, cz + bz, TerrainGenerator.ID_WOOD);
                        }
                    }
                }
                
                if (Math.random() > 0.6) {
                    this.world.setBlock(cx + 2, cy, cz + 1, this.getLightBlockId(cx + 2, cy, cz + 1));
                }
            }
        }

       
        if (this.debugChunkBorders) {
            const BORDER_MATERIAL = TerrainGenerator.ID_WOOD; 
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