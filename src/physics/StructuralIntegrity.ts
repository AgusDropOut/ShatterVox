import { World } from "../world/World";
import { Debri } from "../world/Debri";
import { globalEventBus } from "../core/EventBus";
import type { PhysicsFacade } from "./PhysicsFacade";
import { Engine } from "../core/Engine";
import { Chunk } from "../world/Chunk";

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

              
                this.evaluateShatter(targetDebri, arrayX, arrayY, arrayZ);
            }
        });
    }

    public checkSupport(x: number, y: number, z: number): void {
        const neighbors = [
            [x + 1, y, z], [x - 1, y, z],
            [x, y + 1, z], [x, y - 1, z],
            [x, y, z + 1], [x, y, z - 1]
        ];

        const chunksToUpdate = new Set<string>();

        for (const [nx, ny, nz] of neighbors) {
            const blockId = this.world.getBlock(nx, ny, nz);
            if (blockId === 0) continue;

            const island = this.findIsland(nx, ny, nz, (bx, by, bz) => this.world.getBlock(bx, by, bz), true);
            
            if (!island.isAnchored) {
                const modified = this.markAsDebris(island.blocks);
                for (const chunkKey of modified) {
                    chunksToUpdate.add(chunkKey);
                }
            }
        }
        
        for (const key of chunksToUpdate) {
            const [cx, cy, cz] = key.split(',').map(Number);
            this.world.updateChunkMeshAt(cx * Chunk.WIDTH, cy * Chunk.HEIGHT, cz * Chunk.DEPTH);
        }
    }

    private findIsland(startX: number, startY: number, startZ: number, getBlock: (x: number, y: number, z: number) => number, checkAnchor: boolean) {
        const startId = getBlock(startX, startY, startZ);
      
        const queue: number[][] = [[startX, startY, startZ, startId]];
        let head = 0; 
        
        const visited = new Set<string>();
        const islandBlocks: number[][] = [];
        let isAnchored = false;

        visited.add(`${startX},${startY},${startZ}`);

        while (head < queue.length) {
            const [cx, cy, cz, blockId] = queue[head++]; 
            islandBlocks.push([cx, cy, cz, blockId]);
            
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

                const nId = getBlock(nx, ny, nz);
                if (nId !== 0) {
                    visited.add(key);
                    queue.push([nx, ny, nz, nId]);
                }
            }
        }

        return { isAnchored, blocks: islandBlocks, visitedKeys: visited };
    }

    private markAsDebris(blocks: number[][]): Set<string> {
        const modifiedChunks = new Set<string>();
        if (blocks.length === 0) return modifiedChunks;

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
            
            const chunkX = Math.floor(x / Chunk.WIDTH);
            const chunkY = Math.floor(y / Chunk.HEIGHT);
            const chunkZ = Math.floor(z / Chunk.DEPTH);
            modifiedChunks.add(`${chunkX},${chunkY},${chunkZ}`);

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
        this.world.updateDebriMesh(debri);

        return modifiedChunks;
    }

   
    public evaluateShatter(debri: Debri, rx: number, ry: number, rz: number): void {
        const neighbors = [
            [rx + 1, ry, rz], [rx - 1, ry, rz],
            [rx, ry + 1, rz], [rx, ry - 1, rz],
            [rx, ry, rz + 1], [rx, ry, rz - 1]
        ];

        const validNeighbors: number[][] = [];
        for (const [nx, ny, nz] of neighbors) {
            if (debri.getBlock(nx, ny, nz) !== 0) {
                validNeighbors.push([nx, ny, nz]);
            }
        }

        
        if (validNeighbors.length === 0) {
            this.world.removeDebri(debri);
            debri.deleteGraphics();
            globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: debri.id });
            return;
        }

 
        if (validNeighbors.length === 1) {
            this.world.updateDebriMesh(debri); 
            return;
        }

        const visitedGlobal = new Set<string>();
        const islands: number[][][] = [];

       
        for (const [nx, ny, nz] of validNeighbors) {
            const key = `${nx},${ny},${nz}`;
            if (visitedGlobal.has(key)) continue; 

            const result = this.findIsland(nx, ny, nz, (bx, by, bz) => debri.getBlock(bx, by, bz), false);
            islands.push(result.blocks);

            for (const vKey of result.visitedKeys) {
                visitedGlobal.add(vKey);
            }
        }

        if (islands.length <= 1) {
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

            for (const [lx, ly, lz, blockId] of island) {
                debri.setBlock(lx, ly, lz, 0);
  
                newDebri.setBlock(lx, ly, lz, blockId);

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