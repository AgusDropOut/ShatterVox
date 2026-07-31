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
    private worker: Worker;

    constructor(gl: WebGL2RenderingContext, world: World, physicsFacade: PhysicsFacade) {
        this.gl = gl;
        this.world = world;
        this.physicsFacade = physicsFacade;

        this.worker = new Worker(new URL('./structural.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);

        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            this.checkSupportAsync(data.x, data.y, data.z, data.radius || 1);
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

                this.worker.postMessage({
                    type: 'EVALUATE_SHATTER',
                    debriId: targetDebri.id,
                    blocks: targetDebri['blocks'].slice(),
                    rx: arrayX,
                    ry: arrayY,
                    rz: arrayZ
                });
            }
        });
    }

    private handleWorkerMessage(data: any): void {
        if (data.type === 'SHATTER_RESULT') {
            this.handleShatterResult(data);
        } 
        else if (data.type === 'STATIC_CHECK_RESULT') {
            this.handleStaticSupportResult(data);
        }
    }

    private handleShatterResult(data: any): void {
        const { debriId, islands } = data;
            const debri = this.world.debri.find(d => d.id === debriId);
            if (!debri) return;

            if (islands.length === 0) {
                let isEmpty = true;
                for (let i = 0; i < debri['blocks'].length; i++) {
                    if (debri['blocks'][i] !== 0) { isEmpty = false; break; }
                }
                
                if (isEmpty) {
                    this.world.removeDebri(debri);
                    debri.deleteGraphics();
                    globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: debri.id });
                } else {
                    this.world.updateDebriMesh(debri);
                }
                return;
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

    private handleStaticSupportResult(data: any): void {
         const { detachedBlocks, minX, minY, minZ } = data;
            if (!detachedBlocks || detachedBlocks.length === 0) return;

            const chunksToUpdate = new Set<string>();

            for (const island of detachedBlocks) {
                const islandBlocksFormatted: number[][] = [];
                for (const [lx, ly, lz, blockId] of island) {
                    const worldX = lx + minX;
                    const worldY = ly + minY;
                    const worldZ = lz + minZ;

                    this.world.setBlock(worldX, worldY, worldZ, 0);

                    const chunkX = Math.floor(worldX / Chunk.WIDTH);
                    const chunkY = Math.floor(worldY / Chunk.HEIGHT);
                    const chunkZ = Math.floor(worldZ / Chunk.DEPTH);
                    chunksToUpdate.add(`${chunkX},${chunkY},${chunkZ}`);

                    globalEventBus.emit("PHYSICS_COMMAND", {
                        type: 'REMOVE_TERRAIN_COLLIDER',
                        x: worldX,
                        y: worldY,
                        z: worldZ
                    });

                    islandBlocksFormatted.push([worldX, worldY, worldZ, blockId]);
                }

                if (islandBlocksFormatted.length > 0) {
                    let cx = 0, cy = 0, cz = 0;
                    for (const [x, y, z] of islandBlocksFormatted) {
                        cx += x; cy += y; cz += z;
                    }
                    cx /= islandBlocksFormatted.length;
                    cy /= islandBlocksFormatted.length;
                    cz /= islandBlocksFormatted.length;

                    const debriId = this.physicsFacade.generateId();
                    globalEventBus.emit("PHYSICS_COMMAND", {
                        type: 'CREATE_DEBRI',
                        id: debriId,
                        cx: cx, cy: cy, cz: cz,
                        blocks: islandBlocksFormatted
                    });

                    const debri = new Debri(this.gl, debriId, this.physicsFacade, islandBlocksFormatted, cx, cy, cz);
                    this.world.addDebri(debri);
                    this.world.updateDebriMesh(debri);
                }
            }

            for (const key of chunksToUpdate) {
                const [cx, cy, cz] = key.split(',').map(Number);
                this.world.updateChunkMeshAt(cx * Chunk.WIDTH, cy * Chunk.HEIGHT, cz * Chunk.DEPTH);
            }
    }

    public checkSupportAsync(cx: number, cy: number, cz: number, radius: number = 1): void {
        const rSquared = radius * radius;
        const minX = Math.floor(cx - radius);
        const maxX = Math.ceil(cx + radius);
        const minY = Math.floor(cy - radius);
        const maxY = Math.ceil(cy + radius);
        const minZ = Math.floor(cz - radius);
        const maxZ = Math.ceil(cz + radius);

        const chunksToUpdate = new Set<string>();

     
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const dx = x - cx; 
                    const dy = y - cy; 
                    const dz = z - cz;

                    if (dx * dx + dy * dy + dz * dz <= rSquared) {
                        if (this.world.getBlock(x, y, z) !== 0) {
                            this.world.setBlock(x, y, z, 0);
                            chunksToUpdate.add(`${Math.floor(x / Chunk.WIDTH)},${Math.floor(y / Chunk.HEIGHT)},${Math.floor(z / Chunk.DEPTH)}`);
                            globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_TERRAIN_COLLIDER', x, y, z });
                        }
                    }
                }
            }
        }

    
        for (const key of chunksToUpdate) {
            const [cx_c, cy_c, cz_c] = key.split(',').map(Number);
            this.world.updateChunkMeshAt(cx_c * Chunk.WIDTH, cy_c * Chunk.HEIGHT, cz_c * Chunk.DEPTH);
        }

  
        const regionSize = 32;
        const halfSize = regionSize / 2;
        const regionMinX = Math.floor(cx - halfSize);
        const regionMinY = Math.max(0, Math.floor(cy - halfSize));
        const regionMinZ = Math.floor(cz - halfSize);

        const regionBlocks = new Uint8Array(regionSize * regionSize * regionSize);
        let index = 0;

        for (let sz = 0; sz < regionSize; sz++) {
            for (let sy = 0; sy < regionSize; sy++) {
                for (let sx = 0; sx < regionSize; sx++) {
                    regionBlocks[index++] = this.world.getBlock(regionMinX + sx, regionMinY + sy, regionMinZ + sz);
                }
            }
        }

     
        this.worker.postMessage({
            type: 'CHECK_STATIC_SUPPORT',
            blocks: regionBlocks,
            size: regionSize,
            minX: regionMinX,
            minY: regionMinY,
            minZ: regionMinZ
        });
    }

    public checkSupport(x: number, y: number, z: number): void {
        this.checkSupportAsync(x, y, z, 1);
    }
}