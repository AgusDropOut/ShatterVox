import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class RaycastCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'RAYCAST' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'RAYCAST' }>, context: PhysicsContext): void {
        if (!context.world) return;

        const ray = new RAPIER.Ray(
            { x: command.origin[0], y: command.origin[1], z: command.origin[2] },
            { x: command.direction[0], y: command.direction[1], z: command.direction[2] }
        );

        const playerBody = context.dynamicBodies.get(command.excludeId);
        let excludeCollider: RAPIER.Collider | undefined;
        if (playerBody && playerBody.numColliders() > 0) {
            excludeCollider = playerBody.collider(0);
        }

        const hit = context.world.castRay(ray, command.maxDistance, true, undefined, undefined, excludeCollider);

        let hitId: number | undefined = undefined;
        let localX: number | undefined = undefined;
        let localY: number | undefined = undefined;
        let localZ: number | undefined = undefined;

        if (hit) {
            const hitParent = hit.collider.parent();
            if (hitParent) {
             
                for (const [id, body] of context.dynamicBodies.entries()) {
                    if (body.handle === hitParent.handle) {
                        hitId = id; 
                        const localPos = hit.collider.translationWrtParent();
                        if (localPos) {
                            localX = localPos.x;
                            localY = localPos.y;
                            localZ = localPos.z;
                        }
                        break;
                    }
                }
                
            
                if (hitId === undefined && context.terrainCollidersMap) {
                    for (const [id, collider] of context.terrainCollidersMap.entries()) {

                        if (collider.handle === hit.collider.handle) {
                            hitId = id;
                            break;
                        }
                    }
                }
            }
        }

        (self as any).postMessage({
            type: 'RAYCAST_RESULT',
            reqId: command.reqId,
            hit: hit !== null,
            distance: hit ? hit.timeOfImpact : Infinity,
            hitId: hitId,
            localX: localX,
            localY: localY,
            localZ: localZ
        });
    }
}