import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class QueryIntersectionsCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'QUERY_INTERSECTIONS' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'QUERY_INTERSECTIONS' }>, context: PhysicsContext): void {
        if (!context.world) return;

        const shape = new RAPIER.Ball(command.radius);
        const shapePos = { x: command.x, y: command.y, z: command.z };
        const shapeRot = { w: 1.0, x: 0.0, y: 0.0, z: 0.0 };

        const hitSet = new Set<number>();

       
        const handleToIdMap = new Map<number, number>();
        for (const [id, dynamicBody] of context.dynamicBodies.entries()) {
            handleToIdMap.set(dynamicBody.handle, id);
        }

        context.world.intersectionsWithShape(shapePos, shapeRot, shape, (collider) => {
            if (collider.isSensor()) return true;

            const body = collider.parent();
            if (!body || !body.isDynamic()) return true;

            const dynamicId = handleToIdMap.get(body.handle);
            if (dynamicId !== undefined) {
                hitSet.add(dynamicId);
            }

            return true;
        });

        self.postMessage({
            type: 'INTERSECTIONS_RESULT',
            reqId: command.reqId,
            hitIds: Array.from(hitSet)
        });
    }
}