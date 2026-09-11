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

    private async handleMagicBurst(data: { x: number; y: number; z: number; radius: number }): Promise<void> {
        const blockX = Math.round(data.x / Engine.voxelSize);
        const blockY = Math.round(data.y / Engine.voxelSize);
        const blockZ = Math.round(data.z / Engine.voxelSize);
        const maxRadius = data.radius;
        const TARGET_BLOCK_ID = 21; 

        const totalRadiusWorld = maxRadius * Engine.voxelSize;
        const candidateBodyIds = await this.physicsFacade.queryIntersections(data.x, data.y, data.z, totalRadiusWorld);

        const nearbyDebri = this.world.debri.filter(debri => debri && candidateBodyIds.includes(debri.id));

        let currentRadius = 0;

        const expandInterval = setInterval(() => {
            if (currentRadius > maxRadius) {
                clearInterval(expandInterval);
                return;
            }

            const rSq = currentRadius * currentRadius;
            const innerRSq = Math.max(0, (currentRadius - 1) * (currentRadius - 1));

            for (let dx = -currentRadius; dx <= currentRadius; dx++) {
                for (let dy = -currentRadius; dy <= currentRadius; dy++) {
                    for (let dz = -currentRadius; dz <= currentRadius; dz++) {
                        const distSq = dx * dx + dy * dy + dz * dz;
                        
                        if (distSq <= rSq && distSq >= innerRSq) {
                            const bx = blockX + dx;
                            const by = blockY + dy;
                            const bz = blockZ + dz;
                            
                            const currentBlock = this.world.getBlock(bx, by, bz);
                            
                            if (currentBlock !== 0 && currentBlock !== TARGET_BLOCK_ID) {
                                this.world.setBlock(bx, by, bz, TARGET_BLOCK_ID); 
                                this.world.setChunkDirtyAt(bx, by, bz); 
                            }
                        }
                    }
                }
            }

            const burstPos = vec3.fromValues(data.x, data.y, data.z);

            for (const debri of nearbyDebri) {
                if (!debri) continue;

                const debriTransform = this.physicsFacade.transforms.get(debri.id);
                const debriPos = debriTransform ? debriTransform.position : vec3.fromValues(
                    debri.offsetX * Engine.voxelSize, 
                    debri.offsetY * Engine.voxelSize, 
                    debri.offsetZ * Engine.voxelSize
                );
                
                const distToDebri = vec3.distance(burstPos, debriPos);
                
                if (distToDebri <= (currentRadius * Engine.voxelSize) + 5.0) {
                    let debriModified = false;
                    
                    const localX = data.x - debriPos[0];
                    const localY = data.y - debriPos[1];
                    const localZ = data.z - debriPos[2];

                    const dCenterX = Math.round(localX / Engine.voxelSize);
                    const dCenterY = Math.round(localY / Engine.voxelSize);
                    const dCenterZ = Math.round(localZ / Engine.voxelSize);

                    for (let dx = -currentRadius; dx <= currentRadius; dx++) {
                        for (let dy = -currentRadius; dy <= currentRadius; dy++) {
                            for (let dz = -currentRadius; dz <= currentRadius; dz++) {
                                const distSq = dx * dx + dy * dy + dz * dz;
                                if (distSq <= rSq && distSq >= innerRSq) {
                                    const bx = dCenterX + dx;
                                    const by = dCenterY + dy;
                                    const bz = dCenterZ + dz;
                                    
                                    const currentBlock = debri.getBlock(bx, by, bz);
                                    if (currentBlock !== 0 && currentBlock !== TARGET_BLOCK_ID) {
                                        debri.setBlock(bx, by, bz, TARGET_BLOCK_ID);
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

            currentRadius++;
        }, 50);
    }
}