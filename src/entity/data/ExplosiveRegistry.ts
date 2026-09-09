import { vec3 } from "gl-matrix";
import type { EntityRepository } from "../EntityRepository";
import type { PhysicsFacade } from "../../physics/PhysicsFacade";
import { ParticleSpawner } from "../../particle/ParticleSpawner";
import { globalEventBus } from "../../core/EventBus";

export interface ExplosiveBehavior {
    onInteract?: (entityId: number, repo: EntityRepository, physics: PhysicsFacade) => void;
    onUpdate?: (entityId: number, deltaTime: number, repo: EntityRepository, physics: PhysicsFacade) => void;
}

export interface ExplosiveData {
    scale: vec3;
    visualOffset: vec3;
    mass: number;
    restitution: number;
    timer: number;
    radius: number;
    behavior: ExplosiveBehavior;
}

export const ExplosiveRegistry: Record<string, ExplosiveData> = {
    "bomb": {
        scale: vec3.fromValues(0.4, 0.4, 0.4),
        visualOffset: vec3.fromValues(0, -0.125, 0),
        mass: 5.0,
        restitution: 0.5,
        timer: 3.0,
        radius: 30,
        behavior: {
            onInteract: (entityId, repo, physics) => {
                const exp = repo.explosives.get(entityId);
                if (exp && !exp.fuseActive) {
                    exp.fuseActive = true; 
                    const phys = repo.physics.get(entityId);
                    if (phys) {
                        const transform = physics.transforms.get(phys.bodyId);
                        if (transform) {
                            globalEventBus.emit("PLAY_SPATIAL_SOUND", {
                                id: "fire_chill",
                                position: transform.position,
                                volume: 1.0,
                                pitch: 1.5
                            });
                        }
                    }
                }
            },
            onUpdate: (entityId, deltaTime, repo, physics) => {
                const ignited = repo.explosives.get(entityId)?.fuseActive;
                if (ignited) {
                    const phys = repo.physics.get(entityId);
                    const position = phys ? physics.transforms.get(phys.bodyId)?.position : null;
                    if (position) {
                        const fusePos = vec3.fromValues(position[0], position[1] + 0.12, position[2]);
                        ParticleSpawner.spawnFuseAura(fusePos);
                    }
                }
            }
        }
    }
};