import { Chunk } from "./Chunk";
import { World } from "./World";
import { TerrainGenerator } from "./TerrainGenerator";

export class PortfolioTerrainGenerator {
    private world: World;
    private terrainGen: TerrainGenerator;
    private device: GPUDevice;
    private modelLayout: GPUBindGroupLayout;

    constructor(world: World, terrainGen: TerrainGenerator, device: GPUDevice, modelLayout: GPUBindGroupLayout) {
        this.world = world;
        this.terrainGen = terrainGen;
        this.device = device;
        this.modelLayout = modelLayout;
    }

    public generate(): void {
        const CHUNKS_X = 10;
        const CHUNKS_Y = 6;
        const CHUNKS_Z = 16;

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
        const CENTER_X = Math.floor(WORLD_WIDTH / 2);

        this.fillSolidWorld(WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH);
        this.carveOrganicCave(WORLD_WIDTH, WORLD_HEIGHT, CENTER_X);
        this.carveDungeon(WORLD_WIDTH, WORLD_HEIGHT, CENTER_X);
        this.buildIronGate(CENTER_X, 15);
        this.generateSpeleothems(WORLD_WIDTH, WORLD_HEIGHT, CENTER_X);
        this.embedGems(WORLD_WIDTH, WORLD_HEIGHT);
    }

    private fillSolidWorld(w: number, h: number, d: number): void {
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
                for (let z = 0; z < d; z++) {
                    this.world.setBlock(x, y, z, TerrainGenerator.ID_STONE);
                }
            }
        }
    }

    private getPathCenter(z: number, centerX: number): number {
        const offset = Math.sin(z * 0.035) * 16 + Math.cos(z * 0.02) * 10;
        const alignFactor = Math.max(0.0, Math.min(1.0, (150 - z) / 30.0));
        return Math.floor(centerX + offset * alignFactor);
    }

    private carveOrganicCave(w: number, h: number, defaultCX: number): void {
        for (let z = 1; z <= 160; z++) {
            const currentCX = this.getPathCenter(z, defaultCX);
            const slopeFactor = z / 160.0;
            const baseFloorY = 32 - (slopeFactor * 17);
            const startFactor = Math.min(1.0, z / 15.0);

            for (let x = 2; x < w - 2; x++) {
                const distFromCenter = Math.abs(x - currentCX);
                const pathFactor = Math.max(0, distFromCenter - 6) * 0.25; 
                const floorNoise = (Math.sin(x * 0.12) * Math.cos(z * 0.12) * 4.5) * pathFactor;
                const floorY = Math.floor(baseFloorY + floorNoise);
                
                const baseCeilY = floorY + 38 + Math.sin(z * 0.06) * 12; 
                const ceilNoise = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 6;
                const ceilY = Math.ceil(baseCeilY + ceilNoise);

                const baseCaveWidth = 42 + Math.sin(z * 0.04) * 18;
                const caveWidth = baseCaveWidth * startFactor;

                if (distFromCenter < caveWidth && caveWidth > 0) {
                    for (let y = floorY; y <= ceilY; y++) {
                        const wallDist = distFromCenter / caveWidth;
                        const verticalPos = (y - floorY) / (ceilY - floorY); 
                        const ellipseThreshold = wallDist * wallDist + Math.pow(verticalPos * 2 - 1, 2);
                        const roughness = (Math.sin(x * 0.35) + Math.cos(y * 0.35) + Math.sin(z * 0.35)) * 0.06;

                        if (ellipseThreshold + roughness < 1.0) {
                            this.world.setBlock(x, y, z, 0);
                        }
                    }
                }
            }
        }
    }

    private carveDungeon(w: number, h: number, cx: number): void {
        const dungeonFloorY = 15;
        const dungeonCeilY = 42;

        for (let x = cx - 20; x <= cx + 20; x++) {
            for (let z = 161; z < 220; z++) {
                for (let y = dungeonFloorY; y <= dungeonCeilY; y++) {
                    this.world.setBlock(x, y, z, 0);
                }
                this.world.setBlock(x, dungeonFloorY - 1, z, TerrainGenerator.ID_STONE);
                
                if ((x === cx - 18 || x === cx + 18) && z % 12 === 0 && z > 165) {
                    for(let py = dungeonFloorY; py <= dungeonCeilY; py++){
                        this.world.setBlock(x, py, z, TerrainGenerator.ID_STONE);
                        this.world.setBlock(x+1, py, z, TerrainGenerator.ID_STONE);
                        this.world.setBlock(x, py, z+1, TerrainGenerator.ID_STONE);
                        this.world.setBlock(x+1, py, z+1, TerrainGenerator.ID_STONE);
                    }
                }
            }
        }

        for (let x = 30; x <= w - 30; x++) {
            for (let z = 194; z <= 210; z++) {
                for (let y = dungeonFloorY; y <= dungeonFloorY + 22; y++) {
                    this.world.setBlock(x, y, z, 0);
                }
                this.world.setBlock(x, dungeonFloorY - 1, z, TerrainGenerator.ID_STONE);
            }
        }
    }

    private buildIronGate(cx: number, floorY: number): void {
        const gateWidth = 26;
        const gateHeight = 35;
        for (let x = cx - gateWidth; x <= cx + gateWidth; x++) {
            for (let y = floorY - 2; y <= floorY + gateHeight; y++) {
                for (let z = 155; z <= 160; z++) {
                    const isLeftPillar = x >= cx - gateWidth && x <= cx - gateWidth + 5;
                    const isRightPillar = x <= cx + gateWidth && x >= cx + gateWidth - 5;
                    const isTopBeam = y >= floorY + gateHeight - 5;

                    if (isLeftPillar || isRightPillar || isTopBeam) {
                        this.world.setBlock(x, y, z, TerrainGenerator.ID_IRON);
                    }
                }
            }
        }
    }

    private generateSpeleothems(w: number, h: number, cx: number): void {
        for (let x = 15; x < w - 15; x += 3) {
            for (let z = 15; z < 150; z += 3) {
                const currentCX = this.getPathCenter(z, cx);
                const distToCenter = Math.abs(x - currentCX);
                
                if (distToCenter < 12 && Math.random() > 0.02) continue; 
                if (Math.random() > 0.2) continue;

                let localCeil = 0;
                for (let y = h - 10; y > 10; y--) {
                    if (this.world.getBlock(x, y, z) === TerrainGenerator.ID_STONE && this.world.getBlock(x, y - 1, z) === 0) {
                        localCeil = y;
                        break;
                    }
                }

                if (localCeil > 0) {
                    const length = 8 + Math.floor(Math.random() * 22);
                    const baseRadius = length / 4.5;

                    for (let dy = 0; dy < length; dy++) {
                        const currentRadius = baseRadius * (1.0 - (dy / length));
                        const offsetX = Math.sin(dy * 0.25) * 1.2;
                        const offsetZ = Math.cos(dy * 0.25) * 1.2;

                        for (let dx = -Math.ceil(currentRadius); dx <= Math.ceil(currentRadius); dx++) {
                            for (let dz = -Math.ceil(currentRadius); dz <= Math.ceil(currentRadius); dz++) {
                                if (dx * dx + dz * dz <= currentRadius * currentRadius) {
                                    this.world.setBlock(Math.floor(x + dx + offsetX), localCeil - dy, Math.floor(z + dz + offsetZ), TerrainGenerator.ID_STONE);
                                }
                            }
                        }
                    }
                }

                if (distToCenter > 16 && Math.random() < 0.3) {
                    let localFloor = 0;
                    for (let y = 10; y < 55; y++) {
                        if (this.world.getBlock(x, y, z) === TerrainGenerator.ID_STONE && this.world.getBlock(x, y + 1, z) === 0) {
                            localFloor = y;
                            break;
                        }
                    }

                    if (localFloor > 0) {
                        const length = 5 + Math.floor(Math.random() * 12);
                        const baseRadius = length / 4.0;

                        for (let dy = 0; dy < length; dy++) {
                            const currentRadius = baseRadius * (1.0 - (dy / length));
                            for (let dx = -Math.ceil(currentRadius); dx <= Math.ceil(currentRadius); dx++) {
                                for (let dz = -Math.ceil(currentRadius); dz <= Math.ceil(currentRadius); dz++) {
                                    if (dx * dx + dz * dz <= currentRadius * currentRadius) {
                                        this.world.setBlock(x + dx, localFloor + dy, z + dz, TerrainGenerator.ID_STONE);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private embedGems(w: number, h: number): void {
        for (let x = 10; x < w - 10; x++) {
            for (let y = 15; y < h - 10; y++) {
                for (let z = 10; z < 160; z++) {
                    if (this.world.getBlock(x, y, z) === TerrainGenerator.ID_STONE) {
                        const isExposed = 
                            this.world.getBlock(x + 1, y, z) === 0 ||
                            this.world.getBlock(x - 1, y, z) === 0 ||
                            this.world.getBlock(x, y + 1, z) === 0 ||
                            this.world.getBlock(x, y - 1, z) === 0 ||
                            this.world.getBlock(x, y, z + 1) === 0 ||
                            this.world.getBlock(x, y, z - 1) === 0;

                        if (isExposed && Math.random() < 0.0008) { 
                            this.world.setBlock(x, y, z, this.terrainGen.getLightBlockId(x, y, z));
                        }
                    }
                }
            }
        }
    }
}