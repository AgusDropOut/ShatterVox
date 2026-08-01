import { globalEventBus } from "../../core/EventBus";
import type { PhysicsFacade } from "../../physics/PhysicsFacade";
import { vec3 } from "gl-matrix";
import type { EntityRepository } from "../EntityRepository";
import type { ExplosiveComponent } from "../Components";
import { Engine } from "../../core/Engine";

export class ExplosiveManager {
    private repository: EntityRepository; 
    private physicsFacade: PhysicsFacade;

    constructor(repository: EntityRepository, physicsFacade: PhysicsFacade) {
        this.repository = repository;
        this.physicsFacade = physicsFacade;

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
            halfExtents: { x: 0.2, y: 0.2, z: 0.2 },
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
        this.repository.explosives.set(entityId, { timer: 3.0, radius: 10, fuseActive: true });
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

                console.log(`Bomb detonated at Block: (${blockX}, ${blockY}, ${blockZ})`);

                globalEventBus.emit("BLOCK_MINED_STATIC", {
                    x: blockX,
                    y: blockY,
                    z: blockZ,
                    radius: exp.radius
                });

                

                globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: phys.bodyId });

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