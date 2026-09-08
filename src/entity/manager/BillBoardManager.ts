import { globalEventBus } from "../../core/EventBus";
import type { PhysicsFacade } from "../../physics/PhysicsFacade";
import { vec3, quat } from "gl-matrix";
import type { EntityRepository } from "../EntityRepository";
import { Engine } from "../../core/Engine";
import type { World } from "../../world/World";

interface BillboardState {
    bodyId: number;
    isDetached: boolean;
    halfExtents: { x: number, y: number, z: number };
}

export class BillBoardManager {
    private repository: EntityRepository; 
    private physicsFacade: PhysicsFacade;
    private world: World;
    private activePanels: Map<number, BillboardState> = new Map();

    constructor(repository: EntityRepository, physicsFacade: PhysicsFacade, world: World) {
        this.repository = repository;
        this.physicsFacade = physicsFacade;
        this.world = world;

        globalEventBus.on("SPAWN_BILLBOARD", (data) => this.spawnBillboard(data));
        globalEventBus.on("BOMB_DETONATED", (data) => this.handleExplosion(data));

        globalEventBus.on("REMOVE_BILLBOARD_BY_BODY", (data) => {
            for (const [entityId, state] of this.activePanels.entries()) {
                if (state.bodyId === data.bodyId) {
                    this.repository.destroyEntity(entityId);
                    
                    if (state.isDetached) {
                        globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: state.bodyId });
                    } else {
                        globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_TERRAIN_BOX', id: state.bodyId });
                    }
                    
                    this.activePanels.delete(entityId);
                    return; 
                }
            }
        });
    }

    private spawnBillboard(data: { x: number, y: number, z: number, rot: any, modelId: string, bodyId: number }): void {
        const entityId = this.repository.createEntity();
        const bodyId = data.bodyId;

        const visualScale = vec3.fromValues(0.35, 0.28, 0.3);
        const halfExtents = { x: 1.0, y: 0.5, z: 0.05 };

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_STATIC_BOX',
            id: bodyId,
            x: data.x, y: data.y, z: data.z,
            rot: data.rot, 
            halfW: halfExtents.x,
            halfH: halfExtents.y, 
            halfD: halfExtents.z
        });

        this.repository.physics.set(entityId, { bodyId });
        
        this.repository.renders.set(entityId, { 
            modelId: data.modelId, 
            scale: visualScale, 
            color: [1, 1, 1],
            visualOffset: vec3.fromValues(0, -0.50, 0),
            position: vec3.fromValues(data.x, data.y, data.z),
            rotation: quat.fromValues(data.rot.x, data.rot.y, data.rot.z, data.rot.w)
        });

        this.activePanels.set(entityId, { bodyId, isDetached: false, halfExtents });
    }

    private handleExplosion(data: { x: number, y: number, z: number, radius: number }): void {
        const explosionPos = vec3.fromValues(data.x, data.y, data.z);
        const blastRadiusWorld = data.radius * Engine.voxelSize * 1.5;

        for (const [entityId, state] of this.activePanels.entries()) {
            if (state.isDetached) continue;

            const renderComp = this.repository.renders.get(entityId);
            const panelPos = renderComp?.position || vec3.create(); 
            
            const distance = vec3.distance(explosionPos, panelPos);

            if (distance <= blastRadiusWorld) {
                this.detachPanel(entityId, state, panelPos, explosionPos);
            }
        }
    }

    private detachPanel(entityId: number, state: BillboardState, panelPos: vec3, explosionPos: vec3): void {
        state.isDetached = true;
        const renderComp = this.repository.renders.get(entityId);
        const rotation = renderComp?.rotation
            ? { x: renderComp.rotation[0], y: renderComp.rotation[1], z: renderComp.rotation[2], w: renderComp.rotation[3] }
            : undefined;

        globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_TERRAIN_BOX', id: state.bodyId });

        const dynamicBodyId = this.physicsFacade.generateId();
        
        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_DYNAMIC_BOX',
            id: dynamicBodyId,
            x: panelPos[0], 
            y: panelPos[1], 
            z: panelPos[2],
            rot: rotation,
            halfExtents: state.halfExtents,
            mass: 15.0, 
            restitution: 0.3 
        });

        this.repository.physics.set(entityId, { bodyId: dynamicBodyId });
        state.bodyId = dynamicBodyId;

        const pushDir = vec3.create();
        vec3.subtract(pushDir, panelPos, explosionPos);
        vec3.normalize(pushDir, pushDir);
        vec3.scale(pushDir, pushDir, 25.0); 

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'APPLY_IMPULSE',
            id: dynamicBodyId,
            x: pushDir[0], y: pushDir[1], z: pushDir[2]
        });
    }

    public update(deltaTime: number): void {}
}