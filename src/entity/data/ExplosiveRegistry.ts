import { vec3 } from "gl-matrix";
import type { EntityRepository } from "../EntityRepository";
import type { PhysicsFacade } from "../../physics/PhysicsFacade";
import { ParticleSpawner } from "../../particle/ParticleSpawner";
import { globalEventBus } from "../../core/EventBus";
import { Engine } from "../../core/Engine";
import type { World } from "../../world/World";
import type { ExplosiveComponent } from "../Components";

export interface ExplosiveBehavior {
    onInteract?: (entityId: number, repo: EntityRepository, physics: PhysicsFacade) => void;
    onUpdate?: (entityId: number, deltaTime: number, repo: EntityRepository, physics: PhysicsFacade) => void;
    onDetonate?: (entityId: number, repo: EntityRepository, physics: PhysicsFacade, world: World, exp: ExplosiveComponent) => void;
}

export interface ExplosiveData {
    scale: vec3;
    visualOffset: vec3;
    halfExtents: vec3;
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
        halfExtents: vec3.fromValues(0.1, 0.1, 0.1),
        mass: 5.0,
        restitution: 0.5,
        timer: 3.0,
        radius: 8, 
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
            },
           onDetonate: async (entityId, repo, physics, world, exp) => {
                const phys = repo.physics.get(entityId);
                if (!phys) {
                    repo.destroyEntity(entityId);
                    return;
                }

                const transform = physics.transforms.get(phys.bodyId);
                if (transform) {
                    const blastX = transform.position[0];
                    const blastY = transform.position[1];
                    const blastZ = transform.position[2];

                    const blockX = Math.round(blastX / Engine.voxelSize);
                    const blockY = Math.round(blastY / Engine.voxelSize);
                    const blockZ = Math.round(blastZ / Engine.voxelSize);

                    setTimeout(() => {
                        globalEventBus.emit("BOMB_DETONATED", {
                            x: blastX,
                            y: blastY,
                            z: blastZ,
                            radius: exp.radius
                        });
                    }, 50);

                    globalEventBus.emit("BLOCK_MINED_STATIC", {
                        x: blockX,
                        y: blockY,
                        z: blockZ,
                        radius: exp.radius
                    });

                    const blastRadiusWorld = exp.radius * Engine.voxelSize;
                    const nearbyDebriIds = await physics.queryIntersections(blastX, blastY, blastZ, blastRadiusWorld);

                    for (const debriId of nearbyDebriIds) {
                        const debriTransform = physics.transforms.get(debriId);
                        if (!debriTransform) continue;

                        const localX = blastX - debriTransform.position[0];
                        const localY = blastY - debriTransform.position[1];
                        const localZ = blastZ - debriTransform.position[2];

                        globalEventBus.emit("BLOCK_MINED_DYNAMIC", {
                            debriId: debriId,
                            localX: localX,
                            localY: localY,
                            localZ: localZ,
                            radius: exp.radius
                        });
                    }

                    globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: phys.bodyId });

                    globalEventBus.emit("PLAY_SPATIAL_SOUND", {
                        id: "nade_explosion",
                        position: vec3.fromValues(blastX, blastY, blastZ),
                        volume: 1.0,
                        pitch: 1.0
                    });

                    setTimeout(() => {
                        globalEventBus.emit("PHYSICS_COMMAND", {
                            type: 'APPLY_RADIAL_IMPULSE',
                            epicenter: { x: blastX, y: blastY, z: blastZ }, 
                            radius: exp.radius * Engine.voxelSize * 1.5,
                            force: 25.0 
                        });
                    }, 50);
                }

                repo.destroyEntity(entityId);
            }
        }
    },
    "blackhole": {
        scale: vec3.fromValues(0.15, 0.15, 0.15),
        visualOffset: vec3.fromValues(0, -0.075, 0),
        halfExtents: vec3.fromValues(0.10, 0.10, 0.10),
        mass: 20.0,
        restitution: 0.1,
        timer: 4.0,
        radius: 12,
        behavior: {
            onInteract: (entityId, repo, physics) => {
                const exp = repo.explosives.get(entityId);
                if (exp && !exp.fuseActive) exp.fuseActive = true; 
            },
            onUpdate: (entityId, deltaTime, repo, physics) => {
                const ignited = repo.explosives.get(entityId)?.fuseActive;
                if (ignited) {
                    const phys = repo.physics.get(entityId);
                    const position = phys ? physics.transforms.get(phys.bodyId)?.position : null;
                    if (position) ParticleSpawner.spawnVoidAura(position);
                }
            },
            onDetonate: (entityId, repo, physics, world, exp) => {
                const phys = repo.physics.get(entityId);
                const transform = phys ? physics.transforms.get(phys.bodyId) : null;
                const epicenter = transform ? vec3.clone(transform.position) : vec3.create();

                if (phys) {
                    globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: phys.bodyId });
                    repo.physics.delete(entityId);
                }

                exp.fuseActive = false;

                const blockX = Math.round(epicenter[0] / Engine.voxelSize);
                const blockY = Math.round(epicenter[1] / Engine.voxelSize);
                const blockZ = Math.round(epicenter[2] / Engine.voxelSize);

                globalEventBus.emit("PLAY_SPATIAL_SOUND", {
                    id: "blackhole",
                    position: epicenter,
                    volume: 1.0,
                    pitch: 1.0
                });

                globalEventBus.emit("BLOCK_MINED_STATIC", {
                    x: blockX,
                    y: blockY,
                    z: blockZ,
                    radius: exp.radius * 0.5
                });

                repo.singularities.set(entityId, {
                    lifeTime: 2.5,
                    epicenter: epicenter,
                    pullRadius: exp.radius * Engine.voxelSize,
                    destructionRadius: exp.radius,
                    pullForce: 2.0 
                });
            }
        }
    },
    "magic_crystal": {
        scale: vec3.fromValues(0.3, 0.4, 0.3),
        visualOffset: vec3.fromValues(0, -0.25, 0),
        halfExtents: vec3.fromValues(0.10, 0.20, 0.10),
        mass: 2.0,
        restitution: 0.2,
        timer: 2.0,
        radius: 10,
        behavior: {
            onInteract: (entityId, repo, physics) => {
                const exp = repo.explosives.get(entityId);
                if (exp && !exp.fuseActive) exp.fuseActive = true; 
            },
            onUpdate: (entityId, deltaTime, repo, physics) => {
                const ignited = repo.explosives.get(entityId)?.fuseActive;
                if (ignited) {
                    const phys = repo.physics.get(entityId);
                    const position = phys ? physics.transforms.get(phys.bodyId)?.position : null;
                    if (position) ParticleSpawner.spawnMagicAura(position);
                }
            },
            onDetonate: (entityId, repo, physics, world, exp) => {
                const phys = repo.physics.get(entityId);
                if (!phys) {
                    repo.destroyEntity(entityId);
                    return;
                }

                const transform = physics.transforms.get(phys.bodyId);
                if (transform) {
                    globalEventBus.emit("MAGIC_BURST", {
                        x: transform.position[0],
                        y: transform.position[1],
                        z: transform.position[2],
                        radius: exp.radius
                    });

                    globalEventBus.emit("PLAY_SPATIAL_SOUND", {
                        id: "crystal_break",
                        position: vec3.fromValues(transform.position[0], transform.position[1], transform.position[2]),
                        volume: 1.0,
                        pitch: 1.0
                    });

                    globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: phys.bodyId });
                }

                repo.destroyEntity(entityId);
            }
        }
    }
};