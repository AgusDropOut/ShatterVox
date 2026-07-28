import { World } from "../world/World";

export class StructuralIntegrity {
    private readonly world: World;

    constructor(world: World) {
        this.world = world;
    }

    public checkSupport(x: number, y: number, z: number): void {
        const neighbors = [
            [x + 1, y, z], [x - 1, y, z],
            [x, y + 1, z], [x, y - 1, z],
            [x, y, z + 1], [x, y, z - 1]
        ];

        for (const [nx, ny, nz] of neighbors) {
            const blockId = this.world.getBlock(nx, ny, nz);

            if (blockId === 0 || blockId === 2) continue;

            const island = this.findIsland(nx, ny, nz);
            
            if (!island.isAnchored) {
                this.markAsDebris(island.blocks);
            }
        }
    }

 
    private findIsland(startX: number, startY: number, startZ: number) {
        const queue: number[][] = [[startX, startY, startZ]];
        const visited = new Set<string>();
        const islandBlocks: number[][] = [];
        let isAnchored = false;

        visited.add(`${startX},${startY},${startZ}`);

        while (queue.length > 0) {
            const [cx, cy, cz] = queue.shift()!;
            islandBlocks.push([cx, cy, cz]);
            
            if (cy <= 0) {
                isAnchored = true;
                break; 
            }

            const neighbors = [
                [cx + 1, cy, cz], [cx - 1, cy, cz],
                [cx, cy + 1, cz], [cx, cy - 1, cz],
                [cx, cy, cz + 1], [cx, cy, cz - 1]
            ];

            for (const [nx, ny, nz] of neighbors) {
                const key = `${nx},${ny},${nz}`;
                if (visited.has(key)) continue;

                const neighborId = this.world.getBlock(nx, ny, nz);

                if (neighborId === 1) {
                    visited.add(key);
                    queue.push([nx, ny, nz]);
                }
            }
        }

        return { isAnchored, blocks: islandBlocks };
    }

    private markAsDebris(blocks: number[][]): void {
        console.log(`[Debug] ${blocks.length} blocks turned into debris!`);
        for (const [x, y, z] of blocks) {
            this.world.chunk.setBlock(x, y, z, 2); 
        }
    }
}