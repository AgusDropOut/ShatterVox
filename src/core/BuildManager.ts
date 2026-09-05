import { globalEventBus } from "./EventBus";
import type { World } from "../world/World";
import { vec3 } from "gl-matrix";
import { Debri } from "../world/Debri";
import type { PhysicsFacade } from "../physics/PhysicsFacade";
import { Engine } from "../core/Engine";

export interface BuildOperation {
    x: number;
    y: number;
    z: number;
    previousBlockId: number;
    newBlockId: number;
}

export class BuildManager {
    private world: World;
    private physicsFacade: PhysicsFacade;
    private device: GPUDevice;
    private layout: GPUBindGroupLayout;

    public isActive: boolean = false;
    public selectedBlockId: number = 1;
    public activeTool: 'SINGLE' | 'BOX' | 'DYNAMIC_BOX' | 'SPHERE' | 'SMOOTH' | 'DYNAMITE' = 'SINGLE';
    public sphereRadius: number = 3;
    
    private undoStack: BuildOperation[][] = [];
    private boxPoints: vec3[] = [];

    constructor(world: World, physicsFacade: PhysicsFacade, device: GPUDevice, layout: GPUBindGroupLayout) {
        this.world = world;
        this.physicsFacade = physicsFacade;
        this.device = device;
        this.layout = layout;
        
        globalEventBus.on("TOGGLE_BUILD_MODE", (data) => {
            this.isActive = data.enabled !== undefined ? data.enabled : !this.isActive;
            this.boxPoints = [];
        });

        globalEventBus.on("SET_BUILD_BLOCK", (data) => {
            this.selectedBlockId = data.id;
        });

        globalEventBus.on("SET_BUILD_TOOL", (data) => {
            this.activeTool = data.tool as 'SINGLE' | 'BOX' | 'DYNAMIC_BOX' | 'SPHERE' | 'SMOOTH' | 'DYNAMITE';
            this.boxPoints = [];
        });

        globalEventBus.on("SET_SPHERE_RADIUS", (data) => {
            this.sphereRadius = data.radius;
        });

        window.addEventListener("keydown", (e) => {
            if (this.isActive && e.ctrlKey && e.code === "KeyZ") {
                this.undoLastOperation();
            }
        });
    }

    public placeSingle(x: number, y: number, z: number): void {
        if (!this.isActive) return;

        const currentBlock = this.world.getBlock(x, y, z);
        if (currentBlock !== 0) return; 

        const batch: BuildOperation[] = [{
            x, y, z,
            previousBlockId: currentBlock,
            newBlockId: this.selectedBlockId
        }];

        this.pushBatch(batch);
        this.world.setBlock(x, y, z, this.selectedBlockId);
        this.world.setChunkDirtyAt(x, y, z);
    }

    public executeSculptAction(x: number, y: number, z: number): void {
        if (this.activeTool === 'DYNAMITE') {
            globalEventBus.emit("BLOCK_MINED_STATIC", { 
                x, y, z, 
                radius: this.sphereRadius 
            });
        } else if (this.activeTool === 'SMOOTH') {
            this.executeSmooth(x, y, z);
        } else if (this.activeTool === 'SPHERE') {
            this.boxPoints = [vec3.fromValues(x, y, z)];
            this.executeSphere();
            this.boxPoints = [];
        }
    }

    public registerBoxPoint(x: number, y: number, z: number): void {
        if (!this.isActive) return;

        this.boxPoints.push(vec3.fromValues(x, y, z));
        
        globalEventBus.emit("PLAY_SPATIAL_SOUND", { 
            id: "stone_collision", 
            position: [x * Engine.voxelSize, y * Engine.voxelSize, z * Engine.voxelSize], 
            volume: 0.8, pitch: 1.5 
        });

        if (this.boxPoints.length === 2) {
            if (this.activeTool === 'DYNAMIC_BOX') {
                this.executeDynamicBox();
            } else if (this.activeTool === 'BOX') {
                this.executeBox();
            }
            this.boxPoints = [];
        }
    }

    private executeSmooth(cx: number, cy: number, cz: number): void {
        const radius = this.sphereRadius;
        const rSquared = radius * radius;
        const batch: BuildOperation[] = [];
        const operationsToApply: {x: number, y: number, z: number, id: number}[] = [];

        for (let x = cx - radius; x <= cx + radius; x++) {
            for (let y = cy - radius; y <= cy + radius; y++) {
                for (let z = cz - radius; z <= cz + radius; z++) {
                    const distSq = (x - cx)**2 + (y - cy)**2 + (z - cz)**2;
                    
                    if (distSq <= rSquared) {
                        const currentBlock = this.world.getBlock(x, y, z);
                        let neighborCount = 0;


                        if (this.world.getBlock(x + 1, y, z) !== 0) neighborCount++;
                        if (this.world.getBlock(x - 1, y, z) !== 0) neighborCount++;
                        if (this.world.getBlock(x, y + 1, z) !== 0) neighborCount++;
                        if (this.world.getBlock(x, y - 1, z) !== 0) neighborCount++;
                        if (this.world.getBlock(x, y, z + 1) !== 0) neighborCount++;
                        if (this.world.getBlock(x, y, z - 1) !== 0) neighborCount++;

                        if (currentBlock !== 0 && neighborCount <= 2) {
                            operationsToApply.push({x, y, z, id: 0});
                            batch.push({ x, y, z, previousBlockId: currentBlock, newBlockId: 0 });
                        } else if (currentBlock === 0 && neighborCount >= 5) {
                            operationsToApply.push({x, y, z, id: this.selectedBlockId});
                            batch.push({ x, y, z, previousBlockId: 0, newBlockId: this.selectedBlockId });
                        }
                    }
                }
            }
        }

        for (const op of operationsToApply) {
            this.world.setBlock(op.x, op.y, op.z, op.id);
            this.world.setChunkDirtyAt(op.x, op.y, op.z);
        }

        if (batch.length > 0) {
            this.pushBatch(batch);
            globalEventBus.emit("PLAY_SPATIAL_SOUND", { 
                id: "stone_collision", 
                position: [cx * Engine.voxelSize, cy * Engine.voxelSize, cz * Engine.voxelSize], 
                volume: 0.5, pitch: 0.8
            });
        }
    }

    private executeSphere(): void {
        const p1 = this.boxPoints[0];

        const cx = p1[0];
        const cy = p1[1];
        const cz = p1[2];

        const rSquared = this.sphereRadius * this.sphereRadius;
        const batch: BuildOperation[] = [];

        for (let x = cx - this.sphereRadius; x <= cx + this.sphereRadius; x++) {
            for (let y = cy - this.sphereRadius; y <= cy + this.sphereRadius; y++) {
                for (let z = cz - this.sphereRadius; z <= cz + this.sphereRadius; z++) {
                    
                    const distSq = (x - cx)**2 + (y - cy)**2 + (z - cz)**2;
                    if (distSq <= rSquared) {
                        const currentBlock = this.world.getBlock(x, y, z);
                        if (currentBlock !== this.selectedBlockId) {
                            batch.push({ x, y, z, previousBlockId: currentBlock, newBlockId: this.selectedBlockId });
                            this.world.setBlock(x, y, z, this.selectedBlockId);
                            this.world.setChunkDirtyAt(x, y, z);
                        }
                    }
                }
            }
        }

        if (batch.length > 0) {
            this.pushBatch(batch);
        }
    }

    private executeDynamicBox(): void {
        const p1 = this.boxPoints[0];
        const p2 = this.boxPoints[1];

        const minX = Math.min(p1[0], p2[0]);
        const maxX = Math.max(p1[0], p2[0]);
        const minY = Math.min(p1[1], p2[1]);
        const maxY = Math.max(p1[1], p2[1]);
        const minZ = Math.min(p1[2], p2[2]);
        const maxZ = Math.max(p1[2], p2[2]);

        const blocks: number[][] = [];
        const batch: BuildOperation[] = [];
        let cx = 0, cy = 0, cz = 0;

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const currentBlock = this.world.getBlock(x, y, z);
                    
                    if (currentBlock !== 0) {
                        blocks.push([x, y, z, currentBlock]);
                        cx += x; cy += y; cz += z;

                        batch.push({ x, y, z, previousBlockId: currentBlock, newBlockId: 0 });
                        
                        this.world.setBlock(x, y, z, 0);
                        this.world.setChunkDirtyAt(x, y, z);
                    }
                }
            }
        }

        if (blocks.length === 0) return;

        if (batch.length > 0) {
            this.pushBatch(batch);
        }

        cx /= blocks.length;
        cy /= blocks.length;
        cz /= blocks.length;

        const debriId = this.physicsFacade.generateId();
        const debri = new Debri(this.device, this.layout, debriId, this.physicsFacade, blocks, cx, cy, cz, true);
        
        this.world.addDebri(debri);
        this.world.updateDebriMesh(debri);

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_DEBRI',
            id: debriId,
            cx: cx, cy: cy, cz: cz,
            blocks: blocks
        });
    }

    private executeBox(): void {
        const p1 = this.boxPoints[0];
        const p2 = this.boxPoints[1];

        const minX = Math.min(p1[0], p2[0]);
        const maxX = Math.max(p1[0], p2[0]);
        const minY = Math.min(p1[1], p2[1]);
        const maxY = Math.max(p1[1], p2[1]);
        const minZ = Math.min(p1[2], p2[2]);
        const maxZ = Math.max(p1[2], p2[2]);

        const batch: BuildOperation[] = [];

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const currentBlock = this.world.getBlock(x, y, z);
                    if (currentBlock !== this.selectedBlockId) {
                        batch.push({ x, y, z, previousBlockId: currentBlock, newBlockId: this.selectedBlockId });
                        this.world.setBlock(x, y, z, this.selectedBlockId);
                        this.world.setChunkDirtyAt(x, y, z);
                    }
                }
            }
        }

        if (batch.length > 0) {
            this.pushBatch(batch);
        }
    }

    private pushBatch(batch: BuildOperation[]): void {
        this.undoStack.push(batch);
        if (this.undoStack.length > 100) {
            this.undoStack.shift();
        }
    }

    private undoLastOperation(): void {
        if (this.undoStack.length === 0) return;

        const batch = this.undoStack.pop()!;
        let lastX = 0, lastY = 0, lastZ = 0;

        for (const op of batch) {
            this.world.setBlock(op.x, op.y, op.z, op.previousBlockId);
            this.world.setChunkDirtyAt(op.x, op.y, op.z);
            lastX = op.x; lastY = op.y; lastZ = op.z;
        }
        
        globalEventBus.emit("PLAY_SPATIAL_SOUND", { 
            id: "stone_collision", 
            position: [lastX * Engine.voxelSize, lastY * Engine.voxelSize, lastZ * Engine.voxelSize], 
            volume: 0.5, pitch: 0.8
        });
    }

    public getHighlightBounds(target: vec3): { min: vec3, max: vec3 } | null {
        if (!this.isActive || this.selectedBlockId === 999) return null;

        if (this.activeTool === 'SPHERE' || this.activeTool === 'SMOOTH' || this.activeTool === 'DYNAMITE') {
            const cx = target[0];
            const cy = target[1];
            const cz = target[2];
            const r = this.sphereRadius;
            
            return {
                min: vec3.fromValues(cx - r, cy - r, cz - r),
                max: vec3.fromValues(cx + r, cy + r, cz + r)
            };
        }

        if (this.activeTool === 'SINGLE' || this.boxPoints.length === 0) {
            return { min: vec3.clone(target), max: vec3.clone(target) };
        } 
        
        if (this.boxPoints.length === 1) {
            const p1 = this.boxPoints[0];
            
            return {
                min: vec3.fromValues(Math.min(p1[0], target[0]), Math.min(p1[1], target[1]), Math.min(p1[2], target[2])),
                max: vec3.fromValues(Math.max(p1[0], target[0]), Math.max(p1[1], target[1]), Math.max(p1[2], target[2]))
            };
        }
        
        return null;
    }
}