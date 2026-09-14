import { vec3, quat } from "gl-matrix";
import { globalEventBus } from "../../core/EventBus";
import type { PhysicsFacade } from "../../physics/PhysicsFacade";
import type { EntityRepository } from "../EntityRepository";
import { BookRegistry } from "../data/BookRegistry";

export class BookManager {
    private repository: EntityRepository;
    private physicsFacade: PhysicsFacade;
    private activeBooks = new Set<number>();

    constructor(repository: EntityRepository, physicsFacade: PhysicsFacade) {
        this.repository = repository;
        this.physicsFacade = physicsFacade;

        globalEventBus.on("SPAWN_ENTITY", (data) => {
            if (BookRegistry[data.modelId]) {
                console.log(`Spawning book entity with modelId: ${data.modelId}`);
                this.spawnBook(data);
            } else  {
                console.warn(`Book modelId "${data.modelId}" not found in BookRegistry.`);
            }
        });

        globalEventBus.on("REMOVE_ENTITY_BY_BODY", (data) => {
            for (const [entityId, physComp] of this.repository.physics.entries()) {
                if (physComp.bodyId === data.bodyId && this.activeBooks.has(entityId)) {
                    this.repository.destroyEntity(entityId);
                    this.activeBooks.delete(entityId);
                    globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: data.bodyId });
                    return;
                }
            }
        });
    }

    private spawnBook(data: { modelId: string, bodyId?: number, x: number, y: number, z: number, vx?: number, vy?: number, vz?: number, rot?: any }): void {
        const config = BookRegistry[data.modelId];
        const entityId = this.repository.createEntity();
        const bodyId = data.bodyId ?? this.physicsFacade.generateId();

       
        const rot = data.rot ?? { x: 0, y: 0, z: 0, w: 1 };

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_DYNAMIC_BOX',
            id: bodyId,
            x: data.x, y: data.y, z: data.z,
            rot: rot,
            halfExtents: { x: config.scale[0] / 1.8, y: config.scale[1] / 5.5, z: config.scale[2] / 2.5 },
            mass: config.mass,
            restitution: 0.1
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
            modelId: config.renderModel,
            spawnId: data.modelId,
            scale: vec3.fromValues(config.scale[0], config.scale[1], config.scale[2]),
            color: config.color,
            visualOffset: vec3.fromValues(0, -0.115, 0),
            position: vec3.fromValues(data.x, data.y, data.z),
            rotation: quat.fromValues(rot.x, rot.y, rot.z, rot.w)
        });

        this.repository.interactables.set(entityId, {
            onInteract: () => {
                globalEventBus.emit("SHOW_BOOK", {
                    title: config.title,
                    content: config.content,
                    color: config.color
                });
            }
        });

        this.activeBooks.add(entityId);
    }
}