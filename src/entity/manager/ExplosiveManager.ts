// src/entity/systems/ExplosiveSystem.ts
import { EntityRepository } from "../EntityRepository";
import { globalEventBus } from "../../core/EventBus";
import type { PhysicsFacade } from "../../physics/PhysicsFacade";
import type { ExplosiveComponent } from "../Components";

export class ExplosiveManager {
    private repository: EntityRepository;
    private physicsFacade: PhysicsFacade;

    constructor(repository: EntityRepository, physicsFacade: PhysicsFacade) {
        this.repository = repository;
        this.physicsFacade = physicsFacade;
    }

    public update(deltaTime: number): void {

        for (const [entity, explosive] of this.repository.explosives.entries()) {
            if (!explosive.fuseActive) continue;

            explosive.timer -= deltaTime;

            if (explosive.timer <= 0) {
                this.detonate(entity, explosive);
            }
        }
    }

    private detonate(entity: number, explosive: ExplosiveComponent): void {

        const physComp = this.repository.physics.get(entity);
        
        if (physComp) {

            const transform = this.physicsFacade.transforms.get(physComp.bodyId);
            
            if (transform) {
                globalEventBus.emit("BLOCK_MINED_STATIC", {
                    x: Math.round(transform.position[0]),
                    y: Math.round(transform.position[1]),
                    z: Math.round(transform.position[2]),
                    radius: explosive.radius
                });


                globalEventBus.emit("PHYSICS_COMMAND", { 
                    type: 'REMOVE_BODY', 
                    id: physComp.bodyId 
                });
            }
        }


        this.repository.destroyEntity(entity);
    }
}