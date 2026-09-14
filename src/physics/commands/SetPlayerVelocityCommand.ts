import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class SetPlayerVelocityCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'SET_PLAYER_VELOCITY' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'SET_PLAYER_VELOCITY' }>, context: PhysicsContext): void {
        const body = context.dynamicBodies.get(command.id);
        if (!body) return;

        const currentVel = body.linvel();
        let velY = currentVel.y;

        if (command.jump && Math.abs(currentVel.y) < 0.01) {
            velY = 2.0; 
        }

        body.setLinvel({ x: command.x, y: velY, z: command.z }, true);
    }
}