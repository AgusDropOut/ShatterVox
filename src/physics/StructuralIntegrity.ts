import { World } from "../world/World";

export class StructuralIntegrity {
    
    /**
     * Checks if breaking a block caused any of its neighbors to lose support.
     * @param x X coordinate of the destroyed block.
     * @param y Y coordinate of the destroyed block.
     * @param z Z coordinate of the destroyed block.
     * @param world The world instance.
     */
    public static checkSupport(x: number, y: number, z: number, world: World): void {
        const neighbors = [
            [x + 1, y, z], [x - 1, y, z],
            [x, y + 1, z], [x, y - 1, z],
            [x, y, z + 1], [x, y, z - 1]
        ];

        let hasDebris = false;

        for (const [nx, ny, nz] of neighbors) {
            const blockId = world.getBlock(nx, ny, nz);

            if (blockId === 0 || blockId === 2) continue;

            const island = this.findIsland(nx, ny, nz, world);
            
            if (!island.isAnchored) {
                this.markAsDebris(island.blocks, world);
                hasDebris = true;
            }
        }

        
        
    }

    /**
     * Performs a Flood Fill to determine if a block connects to the ground (Y=0).
     */
    private static findIsland(startX: number, startY: number, startZ: number, world: World) {
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

                const neighborId = world.getBlock(nx, ny, nz);
                

                if (neighborId === 1) {
                    visited.add(key);
                    queue.push([nx, ny, nz]);
                }
            }
        }

        return { isAnchored, blocks: islandBlocks };
    }

  
    private static markAsDebris(blocks: number[][], world: World): void {
        console.log(`[Debug] ${blocks.length} blocks turned into debris!`);
        for (const [x, y, z] of blocks) {
            world.chunk.setBlock(x, y, z, 2); 
        }
    }
}