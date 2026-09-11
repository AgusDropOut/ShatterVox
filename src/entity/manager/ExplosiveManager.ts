import { globalEventBus } from "../../core/EventBus";
import type { PhysicsFacade } from "../../physics/PhysicsFacade";
import type { EntityRepository } from "../EntityRepository";
import type { World } from "../../world/World";
import { ExplosiveRegistry } from "../data/ExplosiveRegistry";
import { vec3 } from "gl-matrix";

export class ExplosiveManager {
    private repository: EntityRepository; 
    private physicsFacade: PhysicsFacade;
    private world: World;

    constructor(repository: EntityRepository, physicsFacade: PhysicsFacade, world: World) {
        this.repository = repository;
        this.physicsFacade = physicsFacade;
        this.world = world;

        globalEventBus.on("SPAWN_ENTITY", (data) => {
            if (ExplosiveRegistry[data.modelId]) {
                this.spawnExplosive(data);
            }
        });

        globalEventBus.on("REMOVE_ENTITY_BY_BODY", (data) => {
            for (const [entityId, physComp] of this.repository.physics.entries()) {
                if (physComp.bodyId === data.bodyId && this.repository.explosives.has(entityId)) {
                    this.repository.destroyEntity(entityId);
                    globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: data.bodyId });
                    return; 
                }
            }
        });
    }

    private spawnExplosive(data: { modelId: string, bodyId?: number, x: number, y: number, z: number, vx?: number, vy?: number, vz?: number, rot?: any }): void {
        const config = ExplosiveRegistry[data.modelId];
        const entityId = this.repository.createEntity();
        const bodyId = data.bodyId ?? this.physicsFacade.generateId();

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_DYNAMIC_BOX',
            id: bodyId,
            x: data.x, y: data.y, z: data.z,
            rot: data.rot, 
            halfExtents: { x: config.halfExtents[0], y: config.halfExtents[1], z: config.halfExtents[2] },
            mass: config.mass,
            restitution: config.restitution 
        });

        if (data.vx !== undefined && data.vy !== undefined && data.vz !== undefined) {
            globalEventBus.emit("PHYSICS_COMMAND", {
                type: 'APPLY_IMPULSE',
                id: bodyId,
                x: data.vx, y: data.vy, z: data.vz
            });
        }
      
        this.repository.physics.set(entityId, { bodyId });

        this.repository.renders.set(entityId, { 
            modelId: data.modelId, 
            scale: vec3.clone(config.scale), 
            color: [1,1,1], 
            visualOffset: vec3.clone(config.visualOffset) 
        });
        
        this.repository.explosives.set(entityId, { timer: config.timer, radius: config.radius, fuseActive: false });
        
        if (config.behavior.onInteract) {
            this.repository.interactables.set(entityId, {
                onInteract: () => config.behavior.onInteract!(entityId, this.repository, this.physicsFacade)
            });
        }

        if (config.behavior.onUpdate) {
            this.repository.updates.set(entityId, {
                onUpdate: (deltaTime: number) => config.behavior.onUpdate!(entityId, deltaTime, this.repository, this.physicsFacade)
            });
        }
    }

    public update(deltaTime: number): void {
        for (const [entity, exp] of this.repository.explosives.entries()) {
            if (!exp.fuseActive) continue;

            exp.timer -= deltaTime;

            if (exp.timer <= 0) {
                const renderComp = this.repository.renders.get(entity);
                if (renderComp) {
                    const config = ExplosiveRegistry[renderComp.modelId];
                    if (config && config.behavior.onDetonate) {
                        config.behavior.onDetonate(entity, this.repository, this.physicsFacade, this.world, exp);
                    }
                }
            }
        }
    }
}