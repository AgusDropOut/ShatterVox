import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class CreateStaticBoxCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'CREATE_STATIC_BOX' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'CREATE_STATIC_BOX' }>, context: PhysicsContext): void {
        if (!context.world) return;
        
        if (!context.terrainRigidBody) {
            context.terrainRigidBody = context.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0));
        }
        
        const colliderDesc = RAPIER.ColliderDesc.cuboid(command.halfW, command.halfH, command.halfD)
            .setTranslation(command.x, command.y, command.z);
            
        context.world.createCollider(colliderDesc, context.terrainRigidBody);
    }
}