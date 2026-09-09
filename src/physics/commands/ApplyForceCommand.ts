import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class ApplyForceCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'APPLY_FORCE' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'APPLY_FORCE' }>, context: PhysicsContext): void {
        const body = context.dynamicBodies.get(command.id);
        if (body) {
            body.addForce({ x: command.x, y: command.y, z: command.z }, true);
        }
    }
}