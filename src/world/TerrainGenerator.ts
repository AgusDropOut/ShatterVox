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
        const CHUNKS_X = 2;
        const CHUNKS_Y = 2; 
        const CHUNKS_Z = 3;

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


        for (let x = 0; x < WORLD_WIDTH; x++) {
            for (let y = 0; y < WORLD_HEIGHT; y++) {
                for (let z = 0; z < WORLD_DEPTH; z++) {
                    let isStone = true;

                    const spineX = (WORLD_WIDTH / 2) + Math.sin(z * 0.15) * 8;
                    const spineY = (WORLD_HEIGHT / 2) - 4 + Math.cos(z * 0.1) * 4;

                    const dx = x - spineX;
                    const dy = y - spineY;
                    
                    const noise = Math.sin(x * 0.2) * Math.cos(y * 0.2) * Math.sin(z * 0.2) * 3;
                    const zRatio = z / WORLD_DEPTH;
                    const cavernBulge = Math.sin(zRatio * Math.PI) * 6; 
                    
                    const radius = 10 + Math.sin(z * 0.1) * 3 + noise + cavernBulge;
                    const distSq = (dx * dx) + (dy * dy * 1.8); 

                    if (distSq < radius * radius) {
                        isStone = false;
                    }

                    if (y < 4 + Math.sin(x * 0.3 + z * 0.3) * 1.5) {
                        isStone = true;
                    }

                    if (x < 2 || x >= WORLD_WIDTH - 2 || y < 2 || y >= WORLD_HEIGHT - 2 || z < 2 || z >= WORLD_DEPTH - 2) {
                        isStone = true;
                    }

                    if (isStone) {
                        this.world.setBlock(x, y, z, ID_STONE);
                    }
                }
            }
        }

        const ruinWidth = 16;
        const ruinDepth = 16;
        const ruinCX = Math.floor((WORLD_WIDTH / 2) + Math.sin((WORLD_DEPTH / 2) * 0.15) * 8);
        const ruinCZ = Math.floor(WORLD_DEPTH / 2);
        
        const startX = ruinCX - Math.floor(ruinWidth / 2);
        const startZ = ruinCZ - Math.floor(ruinDepth / 2);
        const ruinBaseY = 5;

        for (let x = startX; x < startX + ruinWidth; x++) {
            for (let z = startZ; z < startZ + ruinDepth; z++) {
                for (let y = 1; y <= ruinBaseY; y++) {
                    this.world.setBlock(x, y, z, ID_STONE);
                }
                for (let y = ruinBaseY + 1; y < ruinBaseY + 12; y++) {
                    this.world.setBlock(x, y, z, 0); 
                }
            }
        }

        for (let x = startX; x < startX + ruinWidth; x++) {
            if (Math.random() > 0.3) this.world.setBlock(x, ruinBaseY + 1, startZ, ID_STONE);
            if (Math.random() > 0.3) this.world.setBlock(x, ruinBaseY + 1, startZ + ruinDepth - 1, ID_STONE);
        }
        for (let z = startZ; z < startZ + ruinDepth; z++) {
            if (Math.random() > 0.3) this.world.setBlock(startX, ruinBaseY + 1, z, ID_STONE);
            if (Math.random() > 0.3) this.world.setBlock(startX + ruinWidth - 1, ruinBaseY + 1, z, ID_STONE);
        }

        const addPillar = (px: number, pz: number) => {
            const height = 4 + Math.floor(Math.random() * 3);
            for (let y = ruinBaseY + 1; y <= ruinBaseY + height; y++) {
                this.world.setBlock(px, y, pz, ID_STONE);
                if (y === ruinBaseY + height) {
                    this.world.setBlock(px, y + 1, pz, ID_GLOWSTONE);
                }
            }
        };

        addPillar(startX + 3, startZ + 3);
        addPillar(startX + ruinWidth - 4, startZ + 3);
        addPillar(startX + 3, startZ + ruinDepth - 4);
        addPillar(startX + ruinWidth - 4, startZ + ruinDepth - 4);

     
        const gems = [ID_AMETHYST, ID_RUBY, ID_EMERALD, ID_SAPPHIRE, ID_GLOWSTONE];
        
        for (let i = 0; i < 70; i++) {
            const x = Math.floor(Math.random() * WORLD_WIDTH);
            const z = Math.floor(Math.random() * WORLD_DEPTH);
            
            let y = WORLD_HEIGHT - 3;
            while (this.world.getBlock(x, y, z) !== 0 && y > 0) {
                y--;
            }
            
            if (y > ruinBaseY + 4 && y < WORLD_HEIGHT - 3) {
                const len = 2 + Math.floor(Math.random() * 6);
                const gemId = gems[Math.floor(Math.random() * gems.length)];
                
                for (let j = 0; j < len; j++) {
                    const blockId = (j === len - 1) ? gemId : ID_STONE;
                    this.world.setBlock(x, y - j, z, blockId);
                }
            }
        }

        for (let i = 0; i < 8; i++) {
            const cx = startX + 4 + Math.floor(Math.random() * (ruinWidth - 8));
            const cz = startZ + 4 + Math.floor(Math.random() * (ruinDepth - 8));
            
            for (let bx = 0; bx < 2; bx++) {
                for (let by = 0; by < 2; by++) {
                    for (let bz = 0; bz < 2; bz++) {
                        this.world.setBlock(cx + bx, ruinBaseY + 1 + by, cz + bz, ID_WOOD);
                    }
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