import { globalEventBus } from "../core/EventBus";
import { Engine } from "../core/Engine";
import { vec3 } from "gl-matrix";
import type { World } from "./World";
import type { PhysicsFacade } from "../physics/PhysicsFacade";

export class WorldModifier {
    private world: World;
    private physicsFacade: PhysicsFacade;

    constructor(world: World, physicsFacade: PhysicsFacade) {
        this.world = world;
        this.physicsFacade = physicsFacade;

        globalEventBus.on("MAGIC_BURST", (data) => this.handleMagicBurst(data));
    }

    private handleMagicBurst(data: { x: number; y: number; z: number; radius: number }): void {
        const blockX = Math.round(data.x / Engine.voxelSize);
        const blockY = Math.round(data.y / Engine.voxelSize);
        const blockZ = Math.round(data.z / Engine.voxelSize);
        const r = data.radius;

     
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dz = -r; dz <= r; dz++) {
                    if (dx * dx + dy * dy + dz * dz <= r * r) {
                        const bx = blockX + dx;
                        const by = blockY + dy;
                        const bz = blockZ + dz;
                        
                        const currentBlock = this.world.getBlock(bx, by, bz);
                      
                        if (currentBlock === 1 || currentBlock === 2 || currentBlock === 3 || currentBlock === 16) {
                            this.world.setBlock(bx, by, bz, 7); 
                            this.world.setChunkDirtyAt(bx, by, bz); 
                        }
                    }
                }
            }
        }

     
        const burstPos = vec3.fromValues(data.x, data.y, data.z);
        const burstRadiusWorld = data.radius * Engine.voxelSize;

        for (const debri of this.world.debri) {
            const debriTransform = this.physicsFacade.transforms.get(debri.id);
            const debriPos = debriTransform ? debriTransform.position : vec3.fromValues(
                debri.offsetX * Engine.voxelSize, 
                debri.offsetY * Engine.voxelSize, 
                debri.offsetZ * Engine.voxelSize
            );
            
           
            if (vec3.distance(burstPos, debriPos) <= burstRadiusWorld + 10.0) {
                
                const localX = data.x - debriPos[0];
                const localY = data.y - debriPos[1];
                const localZ = data.z - debriPos[2];

                const dCenterX = Math.round(localX / Engine.voxelSize);
                const dCenterY = Math.round(localY / Engine.voxelSize);
                const dCenterZ = Math.round(localZ / Engine.voxelSize);

                let debriModified = false;

                for (let dx = -r; dx <= r; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        for (let dz = -r; dz <= r; dz++) {
                            if (dx * dx + dy * dy + dz * dz <= r * r) {
                                const bx = dCenterX + dx;
                                const by = dCenterY + dy;
                                const bz = dCenterZ + dz;
                                
                                const currentBlock = debri.getBlock(bx, by, bz);
                                if (currentBlock === 1 || currentBlock === 2 || currentBlock === 3 || currentBlock === 16) {
                                    debri.setBlock(bx, by, bz, 7);
                                    debriModified = true;
                                }
                            }
                        }
                    }
                }

                if (debriModified) {
                    this.world.updateDebriMesh(debri);
                }
            }
        }
        
      
    }
}