

import { Chunk } from "../world/Chunk";
import type { World } from "../world/World";
import type { PhysicsFacade } from "./PhysicsFacade";
import { Debri } from "../world/Debri";
import { globalEventBus } from "../core/EventBus";
import { Engine } from "../core/Engine";
import { BlockRegistry } from "../block/BlockRegistry";

export class DetachmentChecker {
    private world: World;
    private physicsFacade: PhysicsFacade;
    private gl: WebGL2RenderingContext;
    private detachmentWorker: Worker;
    private currentDebriCheckId: number = 0;
    private chunkIterator: IterableIterator<Chunk>;
    private shatterWorker: Worker;
    private staticCheckInterval: number = 100;
    private dynamicCheckInterval: number = 100;
    private alreadyCheckedDebri: Set<number> = new Set();
    private flagedForCheckingChunks: Set<string> = new Set();

    constructor(gl: WebGL2RenderingContext, world: World, physicsFacade: PhysicsFacade, shatterWorker: Worker) {
        this.gl = gl;
        this.world = world;
        this.physicsFacade = physicsFacade;
        this.shatterWorker = shatterWorker;
        this.detachmentWorker = new Worker(new URL('./detachment.worker.ts', import.meta.url), { type: 'module' });
        this.chunkIterator = this.world.chunks.values();

        this.detachmentWorker.onmessage = (e: MessageEvent<any>) => {
            this.handleDetachmentWorkerMessage(e.data);
        }

        setInterval(() => {
            this.makePeriodicDynamicCheck();
        }, this.dynamicCheckInterval);
        
        setInterval(() => {
            this.makePeriodicStaticCheck();
        }, this.staticCheckInterval);
    }

    private makePeriodicDynamicCheck(): void {
        if (!this.physicsFacade.isReady) return;
        if(this.world.debri.length === 0) return;
        if(this.world.debri[this.currentDebriCheckId] === undefined) return;
        if(this.alreadyCheckedDebri.has(this.world.debri[this.currentDebriCheckId].id)) {
            this.currentDebriCheckId = (this.currentDebriCheckId + 1) % this.world.debri.length;
            return;
        }
        this.detachmentWorker.postMessage({ type: 'PERIODIC_DYNAMIC_DETACHMENT_CHECK', debriId: this.currentDebriCheckId, blocks: this.world.debri.find(d => d.id === this.currentDebriCheckId)?.['blocks'].slice() || new Uint8Array(), WIDTH: Debri.WIDTH, HEIGHT: Debri.HEIGHT, DEPTH: Debri.DEPTH });
        this.currentDebriCheckId = (this.currentDebriCheckId + 1) % this.world.debri.length;
        this.alreadyCheckedDebri.add(this.world.debri[this.currentDebriCheckId].id);
    }

    private makePeriodicStaticCheck(): void {
         if (!this.physicsFacade.isReady) return;
            if (this.world.chunks.size === 0) return;
        
            let next = this.chunkIterator.next();
        
            if (next.done) {
                this.chunkIterator = this.world.chunks.values();
                next = this.chunkIterator.next();
            }
        
            if (!next.done && this.flagedForCheckingChunks.has(`${next.value.chunkX},${next.value.chunkY},${next.value.chunkZ}`)) {
                const chunk = next.value;
                        
                this.detachmentWorker.postMessage({ 
                type: 'PERIODIC_STATIC_DETACHMENT_CHECK', 
                chunks: [{ 
                    chunkX: chunk.chunkX, 
                    chunkY: chunk.chunkY, 
                    chunkZ: chunk.chunkZ, 
                    blocks: chunk.getBlocks(),
                    WIDTH: Chunk.WIDTH,
                    HEIGHT: Chunk.HEIGHT,
                    DEPTH: Chunk.DEPTH
                    }] 
                });
                this.flagedForCheckingChunks.delete(`${chunk.chunkX},${chunk.chunkY},${chunk.chunkZ}`);
            }
    }

    private handleDetachmentWorkerMessage(data: any): void {
            if (data.type === 'DETACHMENT_RESULT_DYNAMIC') {
                this.handleDynamicDetachmentResult(data);
            } else if (data.type === 'DETACHMENT_RESULT_STATIC') {
                this.handleStaticDetachmentResult(data);
            }
    }
    
        private handleStaticDetachmentResult(data: any): void {
            const { detachedBlocks } = data;
            const chunksToUpdate = new Set<string>(); 
    
            for (const chunkData of detachedBlocks) {
                const { chunkX, chunkY, chunkZ, blocks } = chunkData;
    
                for (const [lx, ly, lz, blockId] of blocks) {
                    const worldX = (chunkX * Chunk.WIDTH) + lx;
                    const worldY = (chunkY * Chunk.HEIGHT) + ly;
                    const worldZ = (chunkZ * Chunk.DEPTH) + lz;

                    const blockDef = BlockRegistry.get(blockId);
                    const fragmentationChance = blockDef?.fragmentationChance || 0.0;

                    if (Math.random() > fragmentationChance) continue;
    
                    this.world.setBlock(worldX, worldY, worldZ, 0);

                    globalEventBus.emit("BLOCK_MINED_STATIC", { x: worldX, y: worldY, z: worldZ, radius: 1 });
                
                    
                    chunksToUpdate.add(`${chunkX},${chunkY},${chunkZ}`);
                    globalEventBus.emit("PHYSICS_COMMAND", {
                        type: 'REMOVE_TERRAIN_COLLIDER',
                        x: worldX,
                        y: worldY,
                        z: worldZ
                    });
    
    
                    const debriId = this.physicsFacade.generateId();
                    const smallDebri = new Debri(this.gl, debriId, this.physicsFacade, [[worldX, worldY, worldZ, blockId]], worldX, worldY, worldZ);
                    this.world.addDebri(smallDebri);
                    this.world.updateDebriMesh(smallDebri);
    
                    globalEventBus.emit("PHYSICS_COMMAND", {
                        type: 'CREATE_DEBRI',
                        id: debriId,
                        cx: worldX, 
                        cy: worldY, 
                        cz: worldZ,
                        blocks: [[worldX, worldY, worldZ, blockId]]
                    });
                }
            }
    
      
            for (const chunkKey of chunksToUpdate) {
                const [cx, cy, cz] = chunkKey.split(',').map(Number);
                this.world.updateChunkMeshAt(cx * Chunk.WIDTH, cy * Chunk.HEIGHT, cz * Chunk.DEPTH);
            }
        }
    
        private handleDynamicDetachmentResult(data: any): void {
            const { debriId, detachedBlocks } = data;
                const targetDebri = this.world.debri.find(d => d.id === debriId);
                
                if (!targetDebri || detachedBlocks.length === 0) return;
    
                for (const [x, y, z, blockId] of detachedBlocks) {
                    
                    targetDebri.setBlock(x, y, z, 0);
    
                    const lX = (x - targetDebri.offsetX) * Engine.voxelSize;
                    const lY = (y - targetDebri.offsetY) * Engine.voxelSize;
                    const lZ = (z - targetDebri.offsetZ) * Engine.voxelSize;
    
                   
                    const microDebriId = this.physicsFacade.generateId();
                    const smallDebri = new Debri(this.gl, microDebriId, this.physicsFacade, [], 0, 0, 0);
                    
                
                    smallDebri.offsetX = targetDebri.offsetX;
                    smallDebri.offsetY = targetDebri.offsetY;
                    smallDebri.offsetZ = targetDebri.offsetZ;
                    smallDebri.setBlock(x, y, z, blockId);
                    
                    this.world.addDebri(smallDebri);
                    this.world.updateDebriMesh(smallDebri);
    
                 
                    const collidersToMove = new Float32Array([lX, lY, lZ]);
                    
                    globalEventBus.emit("PHYSICS_COMMAND", {
                        type: 'SPLIT_DEBRI',
                        parentId: targetDebri.id,
                        newDebriId: microDebriId,
                        collidersToMove: collidersToMove
                    });
                }
    
            
                this.world.updateDebriMesh(targetDebri);
    
              
                this.shatterWorker.postMessage({
                    type: 'EVALUATE_SHATTER',
                    debriId: targetDebri.id,
                    blocks: targetDebri['blocks'].slice(),
                    rx: targetDebri.offsetX, 
                    ry: targetDebri.offsetY,
                    rz: targetDebri.offsetZ
                });
        }

    public flagChunkForChecking(chunkX: number, chunkY: number, chunkZ: number): void {
        const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
        if(this.flagedForCheckingChunks.has(chunkKey)) return;
        this.flagedForCheckingChunks.add(chunkKey);
    }

}