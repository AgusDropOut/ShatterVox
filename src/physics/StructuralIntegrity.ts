import { World } from "../world/World";
import { Debri } from "../world/Debri";
import { globalEventBus } from "../core/EventBus";
import type { PhysicsFacade } from "./PhysicsFacade";
import { Engine } from "../core/Engine";
import { Chunk } from "../world/Chunk";
import { BlockRegistry } from "../block/BlockRegistry";
import { DetachmentChecker } from "./DetachmentChecker";

export class StructuralIntegrity {
    private readonly world: World;
    private readonly device: GPUDevice;
    private readonly layout: GPUBindGroupLayout;
    private readonly physicsFacade: PhysicsFacade;
    private detachmentChecker: DetachmentChecker;
    private worker: Worker;

    private readonly MAX_DEBRIS_THRESHOLD = 50; 
    private readonly ABSOLUTE_MAX_DEBRIS = 80;

    constructor(device: GPUDevice, layout: GPUBindGroupLayout, world: World, physicsFacade: PhysicsFacade) {
        this.world = world;
        this.physicsFacade = physicsFacade;
        this.device = device;
        this.layout = layout;

        this.worker = new Worker(new URL('./structural.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);

        this.detachmentChecker = new DetachmentChecker(this.device, this.layout, world, physicsFacade, this.worker);

        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            this.checkSupportAsync(data.x, data.y, data.z, data.radius || 1);
        });
        
        globalEventBus.on("BLOCK_MINED_DYNAMIC", (data) => {
            this.checkSupportForDynamicDebri(data);
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
            
            const newDebri = new Debri(this.device, this.layout, newDebriId, this.physicsFacade, [], 0, 0, 0);
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

        for (const island of detachedBlocks) {
            const islandBlocksFormatted: number[][] = [];
            for (const [lx, ly, lz, blockId] of island) {
                const worldX = lx + minX;
                const worldY = ly + minY;
                const worldZ = lz + minZ;

                this.world.setBlock(worldX, worldY, worldZ, 0);
                this.world.setChunkDirtyAt(worldX, worldY, worldZ);
                
                const cx = Math.floor(worldX / Chunk.WIDTH);
                const cy = Math.floor(worldY / Chunk.HEIGHT);
                const cz = Math.floor(worldZ / Chunk.DEPTH);
                this.detachmentChecker.flagChunkForChecking(cx, cy, cz);

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

                const debri = new Debri(this.device, this.layout, debriId, this.physicsFacade, islandBlocksFormatted, cx, cy, cz);
                this.world.addDebri(debri);
                this.world.updateDebriMesh(debri);
            }
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

        const maxExplosionForce = radius * 20.0;
        
        let currentWorldDebrisCount = this.world.debri.length;

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const dx = x - cx; 
                    const dy = y - cy; 
                    const dz = z - cz;
                    const distanceSq = dx * dx + dy * dy + dz * dz;

                    if (distanceSq <= rSquared) {
                        const distance = Math.sqrt(distanceSq);
                        const blockId = this.world.getBlock(x, y, z);
                        
                        if (blockId !== 0) {
                            const forceAtPoint = maxExplosionForce * (1.0 - (distance / radius));
                            const blockDef = BlockRegistry.get(blockId);
                            const blastResistance = blockDef.blastResistance || 10; 
                            const fractureThreshold = blastResistance * (0.7 + Math.random() * 0.6);

                            if (forceAtPoint > fractureThreshold) {
                                this.world.setBlock(x, y, z, 0);
                                this.world.setChunkDirtyAt(x, y, z);
                                
            
                                let overloadMultiplier = 1.0;
                                if (currentWorldDebrisCount > this.MAX_DEBRIS_THRESHOLD) {
                                    if (currentWorldDebrisCount >= this.ABSOLUTE_MAX_DEBRIS) {
                                        overloadMultiplier = 0.0;
                                    } else {
                                        const range = this.ABSOLUTE_MAX_DEBRIS - this.MAX_DEBRIS_THRESHOLD;
                                        const excess = currentWorldDebrisCount - this.MAX_DEBRIS_THRESHOLD;
                                        overloadMultiplier = 1.0 - (excess / range);
                                    }
                                }

                                const baseFragChance = blockDef.fragmentationChance !== undefined ? blockDef.fragmentationChance : 0.0;
                                const finalFragChance = baseFragChance * overloadMultiplier;

                                if (finalFragChance > 0.0 && Math.random() < finalFragChance) {
                                    currentWorldDebrisCount++;
                                    const debriId = this.physicsFacade.generateId();
                                    const smallDebri = new Debri(this.device, this.layout, debriId, this.physicsFacade, [[x, y, z, blockId]], x, y, z);
                                    
                                    this.world.addDebri(smallDebri);
                                    this.world.updateDebriMesh(smallDebri);
                                    
                                    globalEventBus.emit("PHYSICS_COMMAND", { 
                                        type: 'CREATE_DEBRI', id: debriId, 
                                        cx: x, cy: y, cz: z, 
                                        blocks: [[x, y, z, blockId]] 
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        const regionSize = 64; 
        const halfSize = regionSize / 2;
        const regionMinX = Math.floor(cx - halfSize);
        const regionMinY = Math.max(0, Math.floor(cy - halfSize)); 
        const regionMinZ = Math.floor(cz - halfSize);

        const regionBlocks = new Uint8Array(regionSize * regionSize * regionSize);
        let index = 0;

        for (let sz = 0; sz < regionSize; sz++) {
            for (let sy = 0; sy < regionSize; sy++) {
                for (let sx = 0; sx < regionSize; sx++) {
                    const globalX = regionMinX + sx;
                    const globalY = regionMinY + sy;
                    const globalZ = regionMinZ + sz;
                    
                    regionBlocks[index++] = this.world.getBlock(globalX, globalY, globalZ);
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

    private checkSupportForDynamicDebri(data: any): void {
        const targetDebri = this.world.debri.find(d => d.id === data.debriId);
        if (!targetDebri) return;

        let blockCountCheck = 0;
        for (let i = 0; i < targetDebri['blocks'].length; i++) {
            if (targetDebri['blocks'][i] !== 0) blockCountCheck++;
            if (blockCountCheck > 3) break; 
        }

        if (blockCountCheck <= 3) {
            this.world.removeDebri(targetDebri);
            targetDebri.deleteGraphics();
            globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: targetDebri.id });
            return;
        }

        const centerX = Math.round((data.localX / Engine.voxelSize) + targetDebri.offsetX);
        const centerY = Math.round((data.localY / Engine.voxelSize) + targetDebri.offsetY);
        const centerZ = Math.round((data.localZ / Engine.voxelSize) + targetDebri.offsetZ);

        const radius = data.radius || 1;
        const rSquared = radius * radius;
        const maxExplosionForce = radius * 20.0;

        for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x++) {
            for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y++) {
                for (let z = Math.floor(centerZ - radius); z <= Math.ceil(centerZ + radius); z++) {
                    const dx = x - centerX;
                    const dy = y - centerY;
                    const dz = z - centerZ;
                    const distanceSq = dx * dx + dy * dy + dz * dz;

                    if (distanceSq <= rSquared) {
                        const distance = Math.sqrt(distanceSq);
                        const blockId = targetDebri.getBlock(x, y, z);
                        
                        if (blockId !== 0) {
                            const forceAtPoint = maxExplosionForce * (1.0 - (distance / radius));
                            const blockDef = BlockRegistry.get(blockId);
                            const blastResistance = blockDef.blastResistance || 10; 
                            const fractureThreshold = blastResistance * (0.7 + Math.random() * 0.6);

                            if (forceAtPoint > fractureThreshold) {
                                targetDebri.setBlock(x, y, z, 0);

                                const lX = (x - targetDebri.offsetX) * Engine.voxelSize;
                                const lY = (y - targetDebri.offsetY) * Engine.voxelSize;
                                const lZ = (z - targetDebri.offsetZ) * Engine.voxelSize;

                                globalEventBus.emit("PHYSICS_COMMAND", {
                                    type: 'REMOVE_DEBRI_BLOCK',
                                    id: targetDebri.id,
                                    localX: lX, localY: lY, localZ: lZ
                                });
                            }
                        }
                    }
                }
            }
        }

        this.world.updateDebriMesh(targetDebri);

        this.worker.postMessage({
            type: 'EVALUATE_SHATTER',
            debriId: targetDebri.id,
            blocks: targetDebri['blocks'].slice(),
            rx: centerX, ry: centerY, rz: centerZ
        });
    }

    public checkSupport(x: number, y: number, z: number): void {
        this.checkSupportAsync(x, y, z, 1);
    }
}