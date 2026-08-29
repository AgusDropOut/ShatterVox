import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class RemoveBodyCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'REMOVE_BODY' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'REMOVE_BODY' }>, context: PhysicsContext): void {
        const body = context.dynamicBodies.get(command.id);
        if (body && context.world) {
            const numColliders = body.numColliders();
            for (let i = 0; i < numColliders; i++) {
                const collider = body.collider(i);
                context.colliderMaterials.delete(collider.handle);
            }
            
            context.world.removeRigidBody(body);
            context.dynamicBodies.delete(command.id);
        } else {
            console.warn(`No dynamic body found with ID ${command.id} to remove.`);
        }
    }
}