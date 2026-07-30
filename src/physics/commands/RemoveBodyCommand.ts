import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class RemoveBodyCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'REMOVE_BODY' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'REMOVE_BODY' }>, context: PhysicsContext): void {
        const body = context.dynamicBodies.get(command.id);
        if (body && context.world) {
            context.world.removeRigidBody(body);
            context.dynamicBodies.delete(command.id);
        }
    }
}