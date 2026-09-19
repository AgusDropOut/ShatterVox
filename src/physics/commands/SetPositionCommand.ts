import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class SetPositionCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'SET_POSITION' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'SET_POSITION' }>, context: PhysicsContext): void {
        const body = context.dynamicBodies.get(command.id);
        if (!body) {
            console.warn(`[SetPositionCommand] No rigid body found for ID: ${command.id}`);
            return;
        }


        body.setTranslation(command.position, true);


        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
}