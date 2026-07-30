import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class CreatePlayerCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'CREATE_PLAYER' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'CREATE_PLAYER' }>, context: PhysicsContext): void {
        
        console.log(`[CreatePlayerCommand] Creating player with ID: ${command.id}`);
        if (!context.world){
            console.error("[CreatePlayerCommand] No physics world available.");
            return;
        }

        const rbDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(command.x, command.y, command.z)
            .lockRotations();
            
        const rigidBody = context.world.createRigidBody(rbDesc);
        const colDesc = RAPIER.ColliderDesc.capsule(command.halfHeight, command.radius);
        context.world.createCollider(colDesc, rigidBody);
        
        context.dynamicBodies.set(command.id, rigidBody);
        
    }
}