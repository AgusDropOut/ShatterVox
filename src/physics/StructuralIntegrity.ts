import { World } from "../world/World";
import RAPIER from "@dimforge/rapier3d-compat";

export class StructuralIntegrity {
    private readonly world: World;
    private readonly physicsWorld: RAPIER.World;

    constructor(world: World, physicsWorld: RAPIER.World) {
        this.world = world;
        this.physicsWorld = physicsWorld;
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
        if (blocks.length === 0) return;

        // center of grav
        let cx = 0, cy = 0, cz = 0;
        for (const [x, y, z] of blocks) {
            cx += x; cy += y; cz += z;
        }
        cx /= blocks.length;
        cy /= blocks.length;
        cz /= blocks.length;


        for (const [x, y, z] of blocks) {
            this.world.chunk.setBlock(x, y, z, 0); 
        }


        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(cx, cy, cz);
        const rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

    
        for (const [x, y, z] of blocks) {
            const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
                .setTranslation(x - cx, y - cy, z - cz); 
            
            this.physicsWorld.createCollider(colliderDesc, rigidBody);
        }

        console.log(`[Physics] Spawned debris with ${blocks.length} blocks at ${cx.toFixed(1)}, ${cy.toFixed(1)}, ${cz.toFixed(1)}`);
    }
}
