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
    private device: GPUDevice;
    private layout: GPUBindGroupLayout;
    private detachmentWorker: Worker;
    private shatterWorker: Worker;
    
    private flagedForCheckingChunks: Set<string> = new Set();
    private flagedForCheckingDebris: Set<number> = new Set();

    private isBuildMode: boolean = false;

    constructor(device: GPUDevice, layout: GPUBindGroupLayout, world: World, physicsFacade: PhysicsFacade, shatterWorker: Worker) {
        
        this.world = world;
        this.physicsFacade = physicsFacade;
        this.shatterWorker = shatterWorker;
        this.device = device;
        this.layout = layout;
        
        this.detachmentWorker = new Worker(new URL('./detachment.worker.ts', import.meta.url), { type: 'module' });
        this.detachmentWorker.onmessage = (e: MessageEvent<any>) => {
            this.handleDetachmentWorkerMessage(e.data);
        }

        globalEventBus.on("TOGGLE_BUILD_MODE", (data) => {
            this.isBuildMode = data.enabled !== undefined ? data.enabled : !this.isBuildMode;
            if (this.isBuildMode) {
                this.flagedForCheckingChunks.clear();
                this.flagedForCheckingDebris.clear();
            }
        });

        setInterval(() => this.makePeriodicDynamicCheck(), 100);
        setInterval(() => this.makePeriodicStaticCheck(), 100);

        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            if (this.isBuildMode) return;
            const cx = Math.floor(data.x / Chunk.WIDTH);
            const cy = Math.floor(data.y / Chunk.HEIGHT);
            const cz = Math.floor(data.z / Chunk.DEPTH);
            this.flagChunkForChecking(cx, cy, cz);
        });

        globalEventBus.on("BLOCK_MINED_DYNAMIC", (data) => {
            if (this.isBuildMode) return;
            this.flagDebriForChecking(data.debriId);
        });
    }

    public flagChunkForChecking(chunkX: number, chunkY: number, chunkZ: number): void {
        if (this.isBuildMode) return;
        this.flagedForCheckingChunks.add(`${chunkX},${chunkY},${chunkZ}`);
    }

    public flagDebriForChecking(debriId: number): void {
        if (this.isBuildMode) return;
        this.flagedForCheckingDebris.add(debriId);
    }

    private makePeriodicDynamicCheck(): void {
        if (this.isBuildMode || !this.physicsFacade.isReady || this.flagedForCheckingDebris.size === 0) return;

        for (const debriId of this.flagedForCheckingDebris) {
            const targetDebri = this.world.debri.find(d => d.id === debriId);
            if (!targetDebri) continue;

            let blockCount = 0;
            for (let i = 0; i < targetDebri['blocks'].length; i++) {
                if (targetDebri['blocks'][i] !== 0) blockCount++;
                if (blockCount > 3) break; 
            }

            if (blockCount > 3) {
                this.detachmentWorker.postMessage({ 
                    type: 'PERIODIC_DYNAMIC_DETACHMENT_CHECK', 
                    debriId: targetDebri.id, 
                    blocks: targetDebri['blocks'].slice(), 
                    WIDTH: Debri.WIDTH, HEIGHT: Debri.HEIGHT, DEPTH: Debri.DEPTH 
                });
            }
        }
        
        this.flagedForCheckingDebris.clear();
    }

    private makePeriodicStaticCheck(): void {
        if (this.isBuildMode || !this.physicsFacade.isReady || this.flagedForCheckingChunks.size === 0) return;

        const chunksToSend = [];

        for (const chunkKey of this.flagedForCheckingChunks) {
            const [cx, cy, cz] = chunkKey.split(',').map(Number);
            const chunk = this.world.chunks.get(chunkKey);
            
            if (chunk) {
                chunksToSend.push({ 
                    chunkX: cx, chunkY: cy, chunkZ: cz, 
                    blocks: chunk.getBlocks(),
                    WIDTH: Chunk.WIDTH, HEIGHT: Chunk.HEIGHT, DEPTH: Chunk.DEPTH
                });
            }
        }

        if (chunksToSend.length > 0) {
            this.detachmentWorker.postMessage({ 
                type: 'PERIODIC_STATIC_DETACHMENT_CHECK', 
                chunks: chunksToSend 
            });
        }

        this.flagedForCheckingChunks.clear();
    }

    private handleDetachmentWorkerMessage(data: any): void {
        if (this.isBuildMode) return;

        if (data.type === 'DETACHMENT_RESULT_DYNAMIC') {
            this.handleDynamicDetachmentResult(data);
        } else if (data.type === 'DETACHMENT_RESULT_STATIC') {
            this.handleStaticDetachmentResult(data);
        }
    }
    
    private handleStaticDetachmentResult(data: any): void {
        const { detachedBlocks } = data;

        for (const chunkData of detachedBlocks) {
            const { chunkX, chunkY, chunkZ, blocks } = chunkData;
            
            this.flagChunkForChecking(chunkX, chunkY, chunkZ);

            for (const [lx, ly, lz, blockId] of blocks) {
                const worldX = (chunkX * Chunk.WIDTH) + lx;
                const worldY = (chunkY * Chunk.HEIGHT) + ly;
                const worldZ = (chunkZ * Chunk.DEPTH) + lz;

                const blockDef = BlockRegistry.get(blockId);
                const fragmentationChance = blockDef?.fragmentationChance ?? 0.3;

                this.world.setBlock(worldX, worldY, worldZ, 0);
                this.world.setChunkDirtyAt(worldX, worldY, worldZ); 

                if (Math.random() < fragmentationChance) {
                    const debriId = this.physicsFacade.generateId();
                    const smallDebri = new Debri(this.device, this.layout, debriId, this.physicsFacade, [[worldX, worldY, worldZ, blockId]], worldX, worldY, worldZ);
                    this.world.addDebri(smallDebri);
                    this.world.updateDebriMesh(smallDebri);

                    globalEventBus.emit("PHYSICS_COMMAND", {
                        type: 'CREATE_DEBRI',
                        id: debriId,
                        cx: worldX, cy: worldY, cz: worldZ,
                        blocks: [[worldX, worldY, worldZ, blockId]]
                    });
                }
            }
        }
    }

    private handleDynamicDetachmentResult(data: any): void {
        const { debriId, detachedBlocks } = data;
        const targetDebri = this.world.debri.find(d => d.id === debriId);
        
        if (!targetDebri || detachedBlocks.length === 0) return;

        this.flagDebriForChecking(targetDebri.id);

        for (const [x, y, z, blockId] of detachedBlocks) {
            targetDebri.setBlock(x, y, z, 0);

            const lX = (x - targetDebri.offsetX) * Engine.voxelSize;
            const lY = (y - targetDebri.offsetY) * Engine.voxelSize;
            const lZ = (z - targetDebri.offsetZ) * Engine.voxelSize;

            const blockDef = BlockRegistry.get(blockId);
            const fragmentationChance = blockDef?.fragmentationChance ?? 0.3;

            if (Math.random() < fragmentationChance) {
                const microDebriId = this.physicsFacade.generateId();
                const smallDebri = new Debri(this.device, this.layout, microDebriId, this.physicsFacade, [], 0, 0, 0);
                
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
            } else {
                globalEventBus.emit("PHYSICS_COMMAND", {
                    type: 'REMOVE_DEBRI_BLOCK',
                    id: targetDebri.id,
                    localX: lX, localY: lY, localZ: lZ
                });
            }
        }

        this.world.updateDebriMesh(targetDebri);

        let remainingBlocks = 0;
        for (let i = 0; i < targetDebri['blocks'].length; i++) {
            if (targetDebri['blocks'][i] !== 0) remainingBlocks++;
        }

        if (remainingBlocks > 3) {
            this.shatterWorker.postMessage({
                type: 'EVALUATE_SHATTER',
                debriId: targetDebri.id,
                blocks: targetDebri['blocks'].slice(),
                rx: targetDebri.offsetX, ry: targetDebri.offsetY, rz: targetDebri.offsetZ
            });
        }
    }
}