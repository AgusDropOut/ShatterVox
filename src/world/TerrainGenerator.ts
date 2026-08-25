import { Chunk } from "./Chunk";
import { World } from "./World";

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

                    if (lightCount < MAX_LIGHTS) {
                        this.world.setBlock(pathX - 3, pathY + 4, z, this.getLightBlockId(pathX - 3, pathY + 4, z));
                        lightCount++;
                    }
                    if (lightCount < MAX_LIGHTS) {
                        this.world.setBlock(pathX + 3, pathY + 4, z, this.getLightBlockId(pathX + 3, pathY + 4, z));
                        lightCount++;
                    }
                    if (lightCount < MAX_LIGHTS) {
                        this.world.setBlock(pathX, pathY - 1, z, this.getLightBlockId(pathX, pathY - 1, z));
                        lightCount++;
                    }
                }
            }
        }

        const numSpikes = 200; 
        for (let i = 0; i < numSpikes; i++) {
            const x = Math.floor(Math.random() * WORLD_WIDTH);
            const z = Math.floor(Math.random() * WORLD_DEPTH);
            
            let y = WORLD_HEIGHT - 3;
            while (this.world.getBlock(x, y, z) !== 0 && y > 0) y--;
            
            if (y > pathY + 10 && y < WORLD_HEIGHT - 3) {
                const len = 3 + Math.floor(Math.random() * 8);
                const lightId = this.getLightBlockId(x, y, z);
                
                for (let j = 0; j < len; j++) {
                    let blockId = TerrainGenerator.ID_STONE;
                    if (j >= len - 2 && lightCount < MAX_LIGHTS) {
                        blockId = lightId;
                        if (j === len - 1) lightCount++; 
                    }
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
                    let blockId = TerrainGenerator.ID_STONE;
                    if (j >= len - 2 && lightCount < MAX_LIGHTS) {
                        blockId = lightId;
                        if (j === len - 1) lightCount++; 
                    }
                    this.world.setBlock(x, y + j, z, blockId);
                }
            }
        }

        for (let i = 0; i < 40; i++) { 
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
                
                if (Math.random() > 0.6 && lightCount < MAX_LIGHTS) {
                    this.world.setBlock(cx + 2, cy, cz + 1, this.getLightBlockId(cx + 2, cy, cz + 1));
                    lightCount++;
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
        
        for (let x = 1; x < WORLD_WIDTH - 1; x++) {
            for (let y = 1; y < WORLD_HEIGHT - 1; y++) {
                for (let z = 1; z < WORLD_DEPTH - 1; z++) {
                    const blockId = this.world.getBlock(x, y, z);
                    
                    if (this.LIGHT_BLOCKS.includes(blockId)) {
                        const isExposed = 
                            this.world.getBlock(x + 1, y, z) === 0 ||
                            this.world.getBlock(x - 1, y, z) === 0 ||
                            this.world.getBlock(x, y + 1, z) === 0 ||
                            this.world.getBlock(x, y - 1, z) === 0 ||
                            this.world.getBlock(x, y, z + 1) === 0 ||
                            this.world.getBlock(x, y, z - 1) === 0;

                        if (!isExposed) {
                            this.world.setBlock(x, y, z, TerrainGenerator.ID_STONE);
                        }
                    }
                }
            }
        }
    }

    public generateSSGITestMap(): void {
        const CHUNKS_X = 4;
        const CHUNKS_Y = 2; 
        const CHUNKS_Z = 4;

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
                    this.world.setBlock(x, y, z, TerrainGenerator.ID_STONE);
                }
            }
        }

        const padding = 2;
        for (let x = padding; x < WORLD_WIDTH - padding; x++) {
            for (let y = padding; y < WORLD_HEIGHT - padding; y++) {
                for (let z = padding; z < WORLD_DEPTH - padding; z++) {
                    this.world.setBlock(x, y, z, 0); 
                    
                    if (y === padding) {
                        this.world.setBlock(x, y, z, TerrainGenerator.ID_WOOD);
                    }
                }
            }
        }

        const midZ = Math.floor(WORLD_DEPTH / 2);
        for (let x = padding; x < WORLD_WIDTH - padding; x++) {
            for (let y = padding + 1; y < WORLD_HEIGHT - 6; y++) {
                if (x > padding + 3 && x < WORLD_WIDTH - padding - 3) {
                    this.world.setBlock(x, y, midZ, TerrainGenerator.ID_STONE);
                }
            }
        }

        const lightZ = midZ - 6;
        for (let x = padding + 4; x < WORLD_WIDTH - padding - 4; x += 4) {
            this.world.setBlock(x, WORLD_HEIGHT - padding - 1, lightZ, TerrainGenerator.ID_RUBY);
        }
        
        const darkZ = midZ + 6;
        const centerX = Math.floor(WORLD_WIDTH / 2);
        for(let y = padding + 1; y <= padding + 4; y++) {
            this.world.setBlock(centerX, y, darkZ, TerrainGenerator.ID_STONE);
            this.world.setBlock(centerX + 1, y, darkZ, TerrainGenerator.ID_STONE);
            this.world.setBlock(centerX, y, darkZ + 1, TerrainGenerator.ID_STONE);
            this.world.setBlock(centerX + 1, y, darkZ + 1, TerrainGenerator.ID_STONE);
        }
    }

    public generateBoxSSGITestMap(): void {
        const CHUNKS_X = 4;
        const CHUNKS_Y = 2; 
        const CHUNKS_Z = 4;

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
            for (let z = 0; z < WORLD_DEPTH; z++) {
                this.world.setBlock(x, 0, z, TerrainGenerator.ID_STONE);
                this.world.setBlock(x, 1, z, TerrainGenerator.ID_STONE);
            }
        }

        const roomMinX = 16;
        const roomMaxX = 48;
        const roomMinY = 1;
        const roomMaxY = 22;
        const roomMinZ = 16;
        const roomMaxZ = 48;

        for (let x = roomMinX; x <= roomMaxX; x++) {
            for (let y = roomMinY; y <= roomMaxY; y++) {
                for (let z = roomMinZ; z <= roomMaxZ; z++) {
                    const isFloor = (y === roomMinY);
                    const isCeiling = (y === roomMaxY);
                    const isLeftWall = (x === roomMinX);
                    const isRightWall = (x === roomMaxX);
                    const isBackWall = (z === roomMaxZ);
                    const isFrontWall = (z === roomMinZ);

                    if (x > roomMinX && x < roomMaxX && y > roomMinY && y < roomMaxY && z > roomMinZ && z < roomMaxZ) {
                        this.world.setBlock(x, y, z, 0);
                        continue;
                    }

                    if (isFloor) {
                        this.world.setBlock(x, y, z, TerrainGenerator.ID_QUARTZ);
                    } else if (isCeiling) {
                        const midX = Math.floor((roomMinX + roomMaxX) / 2);
                        const midZ = Math.floor((roomMinZ + roomMaxZ) / 2);
                        const isLight = (x == midX) && (z == midZ);
                        this.world.setBlock(x, y, z, isLight ? TerrainGenerator.ID_SAPPHIRE : TerrainGenerator.ID_QUARTZ);
                    } else if (isLeftWall) {
                        this.world.setBlock(x, y, z, TerrainGenerator.ID_REDSTONE);
                    } else if (isRightWall) {
                        this.world.setBlock(x, y, z, TerrainGenerator.ID_GRASS);
                    } else if (isBackWall) {
                        this.world.setBlock(x, y, z, TerrainGenerator.ID_QUARTZ);
                    } else if (isFrontWall) {
                        this.world.setBlock(x, y, z, 0);
                    }
                }
            }
        }

        const boxMinX = 22;
        const boxMaxX = 28;
        const boxMinY = 2;
        const boxMaxY = 8;
        const boxMinZ = 26;
        const boxMaxZ = 32;
        for (let x = boxMinX; x <= boxMaxX; x++) {
            for (let y = boxMinY; y <= boxMaxY; y++) {
                for (let z = boxMinZ; z <= boxMaxZ; z++) {
                    this.world.setBlock(x, y, z, TerrainGenerator.ID_QUARTZ);
                }
            }
        }

        const rectMinX = 34;
        const rectMaxX = 40;
        const rectMinY = 2;
        const rectMaxY = 14;
        const rectMinZ = 34;
        const rectMaxZ = 40;
        for (let x = rectMinX; x <= rectMaxX; x++) {
            for (let y = rectMinY; y <= rectMaxY; y++) {
                for (let z = rectMinZ; z <= rectMaxZ; z++) {
                    this.world.setBlock(x, y, z, TerrainGenerator.ID_QUARTZ);
                }
            }
        }

        const sphereCenterX = 32;
        const sphereCenterY = 5;
        const sphereCenterZ = 22;
        const sphereRadius = 3.5;
        for (let x = Math.floor(sphereCenterX - sphereRadius); x <= Math.ceil(sphereCenterX + sphereRadius); x++) {
            for (let y = Math.floor(sphereCenterY - sphereRadius); y <= Math.ceil(sphereCenterY + sphereRadius); y++) {
                for (let z = Math.floor(sphereCenterZ - sphereRadius); z <= Math.ceil(sphereCenterZ + sphereRadius); z++) {
                    const dx = x - sphereCenterX;
                    const dy = y - sphereCenterY;
                    const dz = z - sphereCenterZ;
                    if (dx * dx + dy * dy + dz * dz <= sphereRadius * sphereRadius) {
                        this.world.setBlock(x, y, z, TerrainGenerator.ID_STONE);
                    }
                }
            }
        }
    }
}