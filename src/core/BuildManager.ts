import { globalEventBus } from "../core/EventBus";
import type { World } from "../world/World";
import { BlockRegistry } from "../block/BlockRegistry";

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
    private undoStack: BuildOperation[] = [];

    constructor(world: World) {
        this.world = world;
        
        globalEventBus.on("TOGGLE_BUILD_MODE", (data) => {
            this.isActive = data.enabled !== undefined ? data.enabled : !this.isActive;
        });

        globalEventBus.on("SET_BUILD_BLOCK", (data) => {
            this.selectedBlockId = data.id;
        });

        window.addEventListener("keydown", (e) => {
            if (this.isActive && e.ctrlKey && e.code === "KeyZ") {
                this.undoLastOperation();
            }
        });
    }

    public placeBlock(x: number, y: number, z: number): void {
        if (!this.isActive) return;

        const currentBlock = this.world.getBlock(x, y, z);
        if (currentBlock !== 0) return; 

        this.undoStack.push({
            x, y, z,
            previousBlockId: currentBlock,
            newBlockId: this.selectedBlockId
        });

        if (this.undoStack.length > 500) {
            this.undoStack.shift();
        }

        this.world.setBlock(x, y, z, this.selectedBlockId);
        this.world.setChunkDirtyAt(x, y, z);
    }

    private undoLastOperation(): void {
        if (this.undoStack.length === 0) return;

        const op = this.undoStack.pop()!;
        this.world.setBlock(op.x, op.y, op.z, op.previousBlockId);
        this.world.setChunkDirtyAt(op.x, op.y, op.z);
        
        globalEventBus.emit("PLAY_SPATIAL_SOUND", { 
            id: "stone_collision", 
            position: [op.x * 0.12, op.y * 0.12, op.z * 0.12], 
            volume: 0.5 
        });
    }
}