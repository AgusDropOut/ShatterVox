import { World } from "../world/World";
import { Debri } from "../world/Debri";
import { globalEventBus } from "../core/EventBus";
import type { PhysicsFacade } from "./PhysicsFacade";
import { Engine } from "../core/Engine";

export class StructuralIntegrity {
    private readonly world: World;
    private readonly gl: WebGL2RenderingContext;
    private readonly physicsFacade: PhysicsFacade;

    constructor(gl: WebGL2RenderingContext, world: World, physicsFacade: PhysicsFacade) {
        this.gl = gl;
        this.world = world;
        this.physicsFacade = physicsFacade;

        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            this.checkSupport(data.x, data.y, data.z);
        });
      
        globalEventBus.on("BLOCK_MINED_DYNAMIC", (data) => {
            const targetDebri = this.world.debri.find(d => d.id === data.debriId);
            if (targetDebri) {
                const arrayX = Math.round((data.localX / Engine.voxelSize) + targetDebri.offsetX);
                const arrayY = Math.round((data.localY / Engine.voxelSize) + targetDebri.offsetY);
                const arrayZ = Math.round((data.localZ / Engine.voxelSize) + targetDebri.offsetZ);

                targetDebri.setBlock(arrayX, arrayY, arrayZ, 0);

                
                globalEventBus.emit("PHYSICS_COMMAND", {
                    type: 'REMOVE_DEBRI_BLOCK',
                    id: targetDebri.id,
                    localX: data.localX,
                    localY: data.localY,
                    localZ: data.localZ
                });

                this.evaluateShatter(targetDebri);
            }
        });
    }

    public checkSupport(x: number, y: number, z: number): void {
        const neighbors = [
            [x + 1, y, z], [x - 1, y, z],
            [x, y + 1, z], [x, y - 1, z],
            [x, y, z + 1], [x, y, z - 1]
        ];

        let chunkModified = false; 

        for (const [nx, ny, nz] of neighbors) {
            const blockId = this.world.getBlock(nx, ny, nz);
            if (blockId === 0) continue;

            const island = this.findIsland(nx, ny, nz, (bx, by, bz) => this.world.getBlock(bx, by, bz), true);
            
            if (!island.isAnchored) {
                this.markAsDebris(island.blocks);
                chunkModified = true; 
            }
        }
        
        if (chunkModified) {
            this.world.updateAllMeshes();
        }
    }

    private findIsland(startX: number, startY: number, startZ: number, getBlock: (x: number, y: number, z: number) => number, checkAnchor: boolean) {
        const queue: number[][] = [[startX, startY, startZ]];
        const visited = new Set<string>();
        const islandBlocks: number[][] = [];
        let isAnchored = false;

        visited.add(`${startX},${startY},${startZ}`);

        while (queue.length > 0) {
            const [cx, cy, cz] = queue.shift()!;
            islandBlocks.push([cx, cy, cz]);
            
            if (checkAnchor && cy <= 0) {
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

                if (getBlock(nx, ny, nz) !== 0) {
                    visited.add(key);
                    queue.push([nx, ny, nz]);
                }
            }
        }

        return { isAnchored, blocks: islandBlocks, visitedKeys: visited };
    }

    private markAsDebris(blocks: number[][]): void {
        if (blocks.length === 0) return;

        let cx = 0, cy = 0, cz = 0;
        for (const [x, y, z] of blocks) {
            cx += x;
            cy += y;
            cz += z;
        }
        cx /= blocks.length;
        cy /= blocks.length;
        cz /= blocks.length;

        for (const [x, y, z] of blocks) {
            this.world.setBlock(x, y, z, 0); 
            globalEventBus.emit("PHYSICS_COMMAND", {
                type: 'REMOVE_TERRAIN_COLLIDER',
                x: x,
                y: y,
                z: z
            });
        }

        const debriId = this.physicsFacade.generateId();

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_DEBRI',
            id: debriId,
            cx: cx,
            cy: cy,
            cz: cz,
            blocks: blocks
        });

        let debri = new Debri(this.gl, debriId, this.physicsFacade, blocks, cx, cy, cz);
        this.world.addDebri(debri);
    }
  
    public evaluateShatter(debri: Debri): void {
        const visitedGlobal = new Set<string>();
        const islands: number[][][] = [];

        for (let x = 0; x < 32; x++) {
            for (let y = 0; y < 32; y++) {
                for (let z = 0; z < 32; z++) {
                    if (debri.getBlock(x, y, z) === 0) continue;
                    
                    const key = `${x},${y},${z}`;
                    if (visitedGlobal.has(key)) continue;

                    const result = this.findIsland(x, y, z, (bx, by, bz) => debri.getBlock(bx, by, bz), false);
                    islands.push(result.blocks);

                    for (const vKey of result.visitedKeys) {
                        visitedGlobal.add(vKey);
                    }
                }
            }
        }

        if (islands.length === 0) {
            this.world.removeDebri(debri);
            debri.deleteGraphics();
            globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: debri.id });
            return;
        }

        if (islands.length === 1) {
            this.world.updateDebriMesh(debri); 
            return;
        }

        const pOffsetX = debri.offsetX;
        const pOffsetY = debri.offsetY;
        const pOffsetZ = debri.offsetZ;

        for (let i = 1; i < islands.length; i++) {
            const island = islands[i];
            const newDebriId = this.physicsFacade.generateId();
            
            const newDebri = new Debri(this.gl, newDebriId, this.physicsFacade, [], 0, 0, 0);
            newDebri.offsetX = pOffsetX;
            newDebri.offsetY = pOffsetY;
            newDebri.offsetZ = pOffsetZ;

            const collidersToMove = new Float32Array(island.length * 3);
            let offset = 0;

            for (const [lx, ly, lz] of island) {
                debri.setBlock(lx, ly, lz, 0);
                newDebri.setBlock(lx, ly, lz, 1);

              
                collidersToMove[offset++] = (lx - pOffsetX) * Engine.voxelSize;
                collidersToMove[offset++] = (ly - pOffsetY) * Engine.voxelSize;
                collidersToMove[offset++] = (lz - pOffsetZ) * Engine.voxelSize;
            }

            globalEventBus.emit("PHYSICS_COMMAND", {
                type: 'SPLIT_DEBRI',
                parentId: debri.id,
                newDebriId: newDebriId,
                collidersToMove: collidersToMove
            });
            
            this.world.addDebri(newDebri);
            this.world.updateDebriMesh(newDebri);
        }

        this.world.updateDebriMesh(debri);
    }
}