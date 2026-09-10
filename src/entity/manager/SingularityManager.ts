import { vec3 } from "gl-matrix";
import { globalEventBus } from "../../core/EventBus";
import { ParticleSpawner } from "../../particle/ParticleSpawner";
import type { EntityRepository } from "../EntityRepository";

export class SingularityManager {
    private repository: EntityRepository;

    constructor(repository: EntityRepository) {
        this.repository = repository;
    }

    public update(deltaTime: number): void {
        for (const [entityId, singularity] of this.repository.singularities.entries()) {
            singularity.lifeTime -= deltaTime;

            if (singularity.lifeTime > 0) {

                ParticleSpawner.spawnImplosionStream(singularity.epicenter, singularity.pullRadius);


                globalEventBus.emit("PHYSICS_COMMAND", {
                    type: 'APPLY_RADIAL_PULL',
                    epicenter: { x: singularity.epicenter[0], y: singularity.epicenter[1], z: singularity.epicenter[2] }, 
                    radius: singularity.pullRadius * 3.5, 
                    force: singularity.pullForce 
                });

                
            } else {
                globalEventBus.emit("VOID_IMPLOSION", {
                    x: singularity.epicenter[0],
                    y: singularity.epicenter[1],
                    z: singularity.epicenter[2],
                    radius: singularity.destructionRadius
                });
                
                this.repository.destroyEntity(entityId);
            }
        }
    }
}