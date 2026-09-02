import { globalEventBus } from "../core/EventBus";
import type { World } from "../world/World";
import { vec3 } from "gl-matrix";

export interface BuildOperation {
    x: number;
    y: number;
    z: number;
    previousBlockId: number;
    newBlockId: number;
}

export class BuildManager {
    private world: World;
    public isActive: boolean = false;
    public selectedBlockId: number = 1;
    public activeTool: 'SINGLE' | 'BOX' = 'SINGLE';
    
    private undoStack: BuildOperation[][] = [];
    private boxPoints: vec3[] = [];

    constructor(world: World) {
        this.world = world;
        
        globalEventBus.on("TOGGLE_BUILD_MODE", (data) => {
            this.isActive = data.enabled !== undefined ? data.enabled : !this.isActive;
            this.boxPoints = [];
        });

        globalEventBus.on("SET_BUILD_BLOCK", (data) => {
            this.selectedBlockId = data.id;
        });

        globalEventBus.on("SET_BUILD_TOOL", (data) => {
            this.activeTool = data.tool as 'SINGLE' | 'BOX';
            this.boxPoints = [];
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

    public registerBoxPoint(x: number, y: number, z: number): void {
        if (!this.isActive) return;

        this.boxPoints.push(vec3.fromValues(x, y, z));
        
        globalEventBus.emit("PLAY_SPATIAL_SOUND", { 
            id: "stone_collision", 
            position: [x * 0.12, y * 0.12, z * 0.12], 
            volume: 0.8, pitch: 1.5 
        });

        if (this.boxPoints.length === 3) {
            this.executeBox();
            this.boxPoints = [];
        }
    }

    private executeBox(): void {
        const p1 = this.boxPoints[0];
        const p2 = this.boxPoints[1];
        const p3 = this.boxPoints[2];

        const minX = Math.min(p1[0], p2[0], p3[0]);
        const maxX = Math.max(p1[0], p2[0], p3[0]);
        const minY = Math.min(p1[1], p2[1], p3[1]);
        const maxY = Math.max(p1[1], p2[1], p3[1]);
        const minZ = Math.min(p1[2], p2[2], p3[2]);
        const maxZ = Math.max(p1[2], p2[2], p3[2]);

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
            position: [lastX * 0.12, lastY * 0.12, lastZ * 0.12], 
            volume: 0.5, pitch: 0.8
        });
    }
}