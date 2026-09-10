import { vec3 } from "gl-matrix";
import { globalEventBus } from "../EventBus";
import { VoxelRaycaster } from "../../physics/VoxelRaycaster";
import { ProjectRegistry } from "../../entity/data/ProjectRegistry";
import type { PlayerController } from "../PlayerController";
import type { IPlayerMode } from "../../types/PlayerMode";

export class GameplayMode implements IPlayerMode {
    private clickTimer: number = 0;
    private isHolding: boolean = false;

    public onEnter(player: PlayerController): void {
        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'CREATE_PLAYER', 
            id: player.playerId,
            x: player.camera.position[0], 
            y: player.camera.position[1], 
            z: player.camera.position[2],
            radius: 0.2,
            halfHeight: 0.3
        });
    }

    public onExit(player: PlayerController): void {
        globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: player.playerId });
        player.draggedEntityId = null;
    }

    public update(player: PlayerController, deltaTime: number): void {
        const transform = player.physicsFacade.transforms.get(player.playerId);
        if (transform) {
            vec3.set(player.targetPosition, transform.position[0], transform.position[1] + 0.3, transform.position[2]);
            const lerpSpeed = 15.0; 
            const t = Math.min(lerpSpeed * deltaTime, 1.0);
            vec3.lerp(player.camera.position, player.camera.position, player.targetPosition, t);
        }

        const velocity = vec3.create();
        const front = vec3.fromValues(player.camera.front[0], 0, player.camera.front[2]);
        vec3.normalize(front, front);
        const right = vec3.create();
        vec3.cross(right, front, [0, 1, 0]);
        vec3.normalize(right, right);

        if (player.input.isKeyPressed("KeyW")) vec3.scaleAndAdd(velocity, velocity, front, player.walkSpeed);
        if (player.input.isKeyPressed("KeyS")) vec3.scaleAndAdd(velocity, velocity, front, -player.walkSpeed);
        if (player.input.isKeyPressed("KeyA")) vec3.scaleAndAdd(velocity, velocity, right, -player.walkSpeed);
        if (player.input.isKeyPressed("KeyD")) vec3.scaleAndAdd(velocity, velocity, right, player.walkSpeed);

        const isJumping = player.input.isKeyPressed("Space");

        globalEventBus.emit("PHYSICS_COMMAND", {
            type: 'SET_PLAYER_VELOCITY',
            id: player.playerId,
            x: velocity[0],
            z: velocity[2],
            jump: isJumping
        });

        if (player.draggedEntityId !== null && player.input.isMouseButtonPressed(0)) {
            const timeHeld = performance.now() - this.clickTimer;
            if (timeHeld >= 150) { 
                this.isHolding = true;
                const targetPos = vec3.create();
                vec3.scaleAndAdd(targetPos, player.camera.position, player.camera.front, player.dragDistance);

                globalEventBus.emit("PHYSICS_COMMAND", {
                    type: 'DRAG_ENTITY',
                    id: player.draggedEntityId,
                    targetX: targetPos[0],
                    targetY: targetPos[1],
                    targetZ: targetPos[2]
                });
            }
        } else if (player.draggedEntityId !== null && !player.input.isMouseButtonPressed(0)) {
            player.draggedEntityId = null;
        }

        if (player.input.isKeyPressed("KeyB")) {
            player.throwItem();
        }

        player.physicsFacade.raycast(player.camera.position, player.camera.front, 10.0, player.playerId).then(res => {
            if (res.hit && res.hitId !== undefined) {
                player.currentHitEntity = res.hitId;
                let foundEntityId = null;
                for (const [id, physComp] of player.entityRepo.physics.entries()) {
                    if (physComp.bodyId === res.hitId) {
                        foundEntityId = id;
                        break;
                    }
                }
                player.currentHitEntityInternalId = foundEntityId;
            } else {
                player.currentHitEntity = null;
                player.currentHitEntityInternalId = null;
            }
        });
    }

    public async onLeftClickDown(player: PlayerController): Promise<void> {
        this.clickTimer = performance.now();
        this.isHolding = false;

        if (player.currentHitEntity !== null) {
            player.draggedEntityId = player.currentHitEntity;
            const t = player.physicsFacade.transforms.get(player.currentHitEntity);
            if (t) {
                player.dragDistance = vec3.distance(player.camera.position, t.position);
            } else {
                player.dragDistance = 5.0; 
            }
        }
    }

    public onLeftClickUp(player: PlayerController): void {
        const duration = performance.now() - this.clickTimer;
        
        if (player.draggedEntityId !== null) {
            player.draggedEntityId = null;
        }

        if (duration < 150 && !this.isHolding) {
            this.executeMining(player);
        }
        
        this.isHolding = false;
    }

    private async executeMining(player: PlayerController): Promise<void> {
        if (!player.canMine) return;
        
        player.canMine = false;
        setTimeout(() => player.canMine = true, player.mineCooldownMs);

        const reach = 10.0;
        const gridHit = VoxelRaycaster.raycastGrid(player.camera.position, player.camera.front, reach, player.world);
        const physicsHit = await player.physicsFacade.raycast(player.camera.position, player.camera.front, reach, player.playerId);

        let hitGridFirst = false;
        if (gridHit.hit && !physicsHit.hit) hitGridFirst = true;
        else if (gridHit.hit && physicsHit.hit && gridHit.distance < physicsHit.distance) hitGridFirst = true;

        if (hitGridFirst) {
            const [x, y, z] = gridHit.blockPos;
            const blockType = player.world.getBlock(x, y, z);
            globalEventBus.emit("BLOCK_MINED_STATIC", { x, y, z, radius: player.destructionRadius, blockType });
        } else if (physicsHit.hit && physicsHit.hitId !== undefined) {
            globalEventBus.emit("BLOCK_MINED_DYNAMIC", {
                debriId: physicsHit.hitId,
                localX: physicsHit.localX!,
                localY: physicsHit.localY!,
                localZ: physicsHit.localZ!,
                radius: player.destructionRadius
            });
        }
    }

    public onRightClickDown(player: PlayerController): void {
        if (player.currentHitEntityInternalId !== null) {
            const interactable = player.entityRepo.interactables.get(player.currentHitEntityInternalId);
            if (interactable) {
                if (interactable.onInteract) interactable.onInteract();
                if (interactable.overlayData) globalEventBus.emit("SHOW_OVERLAY", { data: interactable.overlayData });
            }
        }
    }

    public onRightClickUp(player: PlayerController): void {}
}

export class BuildMode implements IPlayerMode {
    public onEnter(player: PlayerController): void {
        player.currentHitEntity = null;
        player.currentHitEntityInternalId = null;
    }

    public onExit(player: PlayerController): void {
        player.isDraggingBuild = false;
        player.lastBuildPos = "";
    }

    public update(player: PlayerController, deltaTime: number): void {
        const flyVel = vec3.create();
        const front = vec3.fromValues(player.camera.front[0], player.camera.front[1], player.camera.front[2]);
        vec3.normalize(front, front);
        const right = vec3.create();
        vec3.cross(right, front, [0, 1, 0]);
        vec3.normalize(right, right);
        const up = vec3.fromValues(0, 1, 0);

        if (player.input.isKeyPressed("KeyW")) vec3.scaleAndAdd(flyVel, flyVel, front, player.flySpeed);
        if (player.input.isKeyPressed("KeyS")) vec3.scaleAndAdd(flyVel, flyVel, front, -player.flySpeed);
        if (player.input.isKeyPressed("KeyA")) vec3.scaleAndAdd(flyVel, flyVel, right, -player.flySpeed);
        if (player.input.isKeyPressed("KeyD")) vec3.scaleAndAdd(flyVel, flyVel, right, player.flySpeed);
        if (player.input.isKeyPressed("Space")) vec3.scaleAndAdd(flyVel, flyVel, up, player.flySpeed);
        if (player.input.isKeyPressed("ShiftLeft")) vec3.scaleAndAdd(flyVel, flyVel, up, -player.flySpeed);

        vec3.scaleAndAdd(player.camera.position, player.camera.position, flyVel, deltaTime);
        vec3.copy(player.targetPosition, player.camera.position); 

        const reach = 40.0; 
        const gridHit = VoxelRaycaster.raycastGrid(player.camera.position, player.camera.front, reach, player.world);
        
        if (player.buildManager.activeTool === 'SPHERE' || player.buildManager.activeTool === 'SMOOTH' || player.buildManager.activeTool === 'DYNAMITE' || player.buildManager.activeTool === 'CUT_BOX') {
            if (gridHit.hit) player.currentPlacementTarget = vec3.fromValues(gridHit.blockPos[0], gridHit.blockPos[1], gridHit.blockPos[2]);
            else player.currentPlacementTarget = null;
        } else {
            if (gridHit.hit && gridHit.normal) {
                player.currentPlacementTarget = vec3.fromValues(
                    gridHit.blockPos[0] + gridHit.normal[0],
                    gridHit.blockPos[1] + gridHit.normal[1],
                    gridHit.blockPos[2] + gridHit.normal[2]
                );
            } else {
                player.currentPlacementTarget = null;
            }
        }

        if (player.input.isKeyPressed("KeyB")) {
            player.throwItem();
        }

        if (player.isDraggingBuild && player.buildManager.isActive && player.buildManager.selectedBlockId < 900) {
            if (player.buildManager.activeTool === 'SINGLE') {
                player.handleBuildPlacement();
            } else if (player.buildManager.activeTool === 'SPHERE' || player.buildManager.activeTool === 'SMOOTH' || player.buildManager.activeTool === 'DYNAMITE' || player.buildManager.activeTool === 'CUT_BOX') {
                player.handleSculptPlacement();
            }
        }
    }

    public async onLeftClickDown(player: PlayerController): Promise<void> {
        if (!player.canMine) return;
        player.canMine = false;
        setTimeout(() => player.canMine = true, player.mineCooldownMs);

        const reach = 40.0;
        const gridHit = VoxelRaycaster.raycastGrid(player.camera.position, player.camera.front, reach, player.world);
        const physicsHit = await player.physicsFacade.raycast(player.camera.position, player.camera.front, reach, player.playerId);

        let hitGridFirst = false;
        if (gridHit.hit && !physicsHit.hit) hitGridFirst = true;
        else if (gridHit.hit && physicsHit.hit && gridHit.distance < physicsHit.distance) hitGridFirst = true;

        if (player.buildManager.activeTool === 'SINGLE') {
            if (hitGridFirst) {
                const [x, y, z] = gridHit.blockPos;
                player.buildManager.removeSingle(x, y, z);
            } else if (physicsHit.hit && physicsHit.hitId !== undefined) {
                globalEventBus.emit("REMOVE_ENTITY_BY_BODY", { bodyId: physicsHit.hitId });
                player.buildManager.removeSingleDebri(physicsHit.hitId, physicsHit.localX!, physicsHit.localY!, physicsHit.localZ!);
            }
        }
    }

    public onLeftClickUp(player: PlayerController): void {}

    public onRightClickDown(player: PlayerController): void {
        if (player.buildManager.isActive) {
            if (player.buildManager.selectedBlockId >= 900) {
                let selectedModelId = "billboard";
                let customIdCounter = 999;
                for (const modelId in ProjectRegistry) {
                    if (customIdCounter === player.buildManager.selectedBlockId) {
                        selectedModelId = modelId;
                        break;
                    }
                    customIdCounter--;
                }
                player.handleBillboardPlacement(selectedModelId);
            } else {
                if (player.buildManager.activeTool === 'SINGLE') {
                    player.isDraggingBuild = true;
                    player.handleBuildPlacement();
                } else if (player.buildManager.activeTool === 'BOX' || player.buildManager.activeTool === 'DYNAMIC_BOX' || player.buildManager.activeTool === 'CUT_BOX') {
                    player.handleBoxToolClick();
                } else if (player.buildManager.activeTool === 'SPHERE' || player.buildManager.activeTool === 'SMOOTH' || player.buildManager.activeTool === 'DYNAMITE') {
                    player.isDraggingBuild = true;
                    player.handleSculptPlacement();
                }
            }
        }
    }

    public onRightClickUp(player: PlayerController): void {
        player.isDraggingBuild = false;
        player.lastBuildPos = "";

        if (player.buildManager.isActive && player.input.isLocked) {
            if (player.buildManager.activeTool === 'BOX' || player.buildManager.activeTool === 'DYNAMIC_BOX' || player.buildManager.activeTool === 'CUT_BOX') {
                player.handleBoxToolClick();
            }
        }
    }
}