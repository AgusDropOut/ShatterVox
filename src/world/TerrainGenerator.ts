import { Chunk } from "./Chunk";
import { World } from "./World";
import { PortfolioTerrainGenerator } from "./PortfolioTerrainGenerator";

export type LightMode = 'RANDOM' | 'SINGLE_COLOR' | 'CLUSTERED';

export class TerrainGenerator {
    private world: World;
    private device: GPUDevice;
    private modelLayout: GPUBindGroupLayout;
    
    public debugChunkBorders: boolean = false; 
    public lightMode: LightMode = 'RANDOM';
    public clusterScale: number = 0.05;

    public static readonly ID_STONE = 1;
    public static readonly ID_GRASS = 2;
    public static readonly ID_WOOD = 3;
    public static readonly ID_AMETHYST = 5;
    public static readonly ID_RUBY = 6;
    public static readonly ID_EMERALD = 7;
    public static readonly ID_SAPPHIRE = 8;
    public static readonly ID_GLOWSTONE = 9;
    public static readonly ID_REDSTONE = 10;
    public static readonly ID_QUARTZ = 11;
    public static readonly ID_IRON = 14; 
    public static readonly ID_FIRE = 15;

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

    public getLightBlockId(x: number, y: number, z: number): number {
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

    public generatePortfolioTerrain(): void {
        const generator = new PortfolioTerrainGenerator(this.world, this, this.device, this.modelLayout);
        generator.generate();
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

        let lightCount = 0;
        const MAX_LIGHTS = 2000;

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
                            if (Math.random() < 0.005 && lightCount < MAX_LIGHTS) {
                                this.world.setBlock(x, y, z, this.getLightBlockId(x, y, z));
                                lightCount++;
                                continue;
                            }
                        }
                        this.world.setBlock(x, y, z, TerrainGenerator.ID_STONE);
                    } else {
                        if (y <= 5 && Math.abs(dx) < 6 + noise * 0.5) {
                            if (Math.random() < 0.01 && lightCount < MAX_LIGHTS) {
                                this.world.setBlock(x, y, z, this.getLightBlockId(x, y, z));
                                lightCount++;
                            } else if (y < 3) {
                                this.world.setBlock(x, y, z, TerrainGenerator.ID_STONE); 
                            }
                        }
                    }
                }
            }
        }
    }
}