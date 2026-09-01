import { globalEventBus } from "../../core/EventBus";
import type { PhysicsFacade } from "../../physics/PhysicsFacade";
import { vec3 } from "gl-matrix";
import type { EntityRepository } from "../EntityRepository";
import type { ExplosiveComponent } from "../Components";
import { Engine } from "../../core/Engine";
import type { World } from "../../world/World";

export class ExplosiveManager {
    private repository: EntityRepository; 
    private physicsFacade: PhysicsFacade;
    private world: World;

    constructor(repository: EntityRepository, physicsFacade: PhysicsFacade, world: World) {
        this.repository = repository;
        this.physicsFacade = physicsFacade;
        this.world = world;

        globalEventBus.on("SPAWN_BOMB", (data) => this.spawnBomb(data));
    }

    private spawnBomb(data: { x: number, y: number, z: number, vx: number, vy: number, vz: number, rot: any }): void {
        const entityId = this.repository.createEntity();
        const bodyId = this.physicsFacade.generateId();

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_DYNAMIC_BOX',
            id: bodyId,
            x: data.x, y: data.y, z: data.z,
            rot: data.rot, 
            halfExtents: { x: 0.1, y: 0.1, z: 0.1 },
            mass: 5.0,
            restitution: 0.5 
        });

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'APPLY_IMPULSE',
            id: bodyId,
            x: data.vx, y: data.vy, z: data.vz
        });

      
        this.repository.physics.set(entityId, { bodyId });
        this.repository.renders.set(entityId, { modelId: "bomb", scale: vec3.fromValues(0.4, 0.4, 0.4), color: [1,1,1] });
        this.repository.explosives.set(entityId, { timer: 3.0, radius: 30, fuseActive: true });
    }

    public update(deltaTime: number): void {

        for (const [entity, exp] of this.repository.explosives.entries()) {
            if (!exp.fuseActive) continue;

            exp.timer -= deltaTime;

            if (exp.timer <= 0) {
                this.detonate(entity, exp);
            }
        }
    }

    private detonate(entity: number, exp: ExplosiveComponent): void {
        const phys = this.repository.physics.get(entity);
        
        if (phys) {
            const transform = this.physicsFacade.transforms.get(phys.bodyId);
            
            if (transform) {
                const blockX = Math.round(transform.position[0] / Engine.voxelSize);
                const blockY = Math.round(transform.position[1] / Engine.voxelSize);
                const blockZ = Math.round(transform.position[2] / Engine.voxelSize);

                setTimeout(() => {
                    globalEventBus.emit("BOMB_DETONATED", {
                        x: transform.position[0],
                        y: transform.position[1],
                        z: transform.position[2],
                        radius: exp.radius
                    });
                }, 100);


                globalEventBus.emit("BLOCK_MINED_STATIC", {
                    x: blockX,
                    y: blockY,
                    z: blockZ,
                    radius: exp.radius
                });

            
                for (const debri of this.world.debri) {
                    
                    const debriTransform = this.physicsFacade.transforms.get(debri.id);
                    const debriWorldX = debriTransform ? debriTransform.position[0] : (debri.offsetX * Engine.voxelSize);
                    const debriWorldY = debriTransform ? debriTransform.position[1] : (debri.offsetY * Engine.voxelSize);
                    const debriWorldZ = debriTransform ? debriTransform.position[2] : (debri.offsetZ * Engine.voxelSize);

                 
                    const localX = transform.position[0] - debriWorldX;
                    const localY = transform.position[1] - debriWorldY;
                    const localZ = transform.position[2] - debriWorldZ;

                    globalEventBus.emit("BLOCK_MINED_DYNAMIC", {
                        debriId: debri.id,
                        localX: localX,
                        localY: localY,
                        localZ: localZ,
                        radius: exp.radius
                    });
                }

                globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: phys.bodyId });


                globalEventBus.emit("PLAY_SPATIAL_SOUND", {
                    id: "nade_explosion",
                    position: vec3.fromValues(transform.position[0], transform.position[1], transform.position[2]),
                    volume: 1.0,
                    pitch: 1.0
                });

                setTimeout(() => {
                    globalEventBus.emit("PHYSICS_COMMAND", {
                        type: 'APPLY_RADIAL_IMPULSE',
                        epicenter: { x: transform.position[0], y: transform.position[1], z: transform.position[2] }, 
                        radius: exp.radius * Engine.voxelSize * 1.5,
                        force: 25.0 
                    });
                }, 50);
            }
        }

        this.repository.destroyEntity(entity);
    }
}