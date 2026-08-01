
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class ApplyImpulseCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'APPLY_IMPULSE' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'APPLY_IMPULSE' }>, context: PhysicsContext): void {
        
        const body = context.dynamicBodies.get(command.id);
        if (!body) {
            console.error(`[ApplyImpulseCommand] No dynamic body found for ID: ${command.id}`);
            return;
        }

        body.applyImpulse({ x: command.x, y: command.y, z: command.z }, true);

    }
}
        