import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class SetPlayerVelocityCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'SET_PLAYER_VELOCITY' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'SET_PLAYER_VELOCITY' }>, context: PhysicsContext): void {
        const body = context.dynamicBodies.get(command.id);
        if (body) {
            body.setLinvel({ x: command.x, y: command.y, z: command.z }, true);
        }
    }
}