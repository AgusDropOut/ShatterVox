
import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";


export class CreateDynamicBoxCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'CREATE_DYNAMIC_BOX' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'CREATE_DYNAMIC_BOX' }>, context: PhysicsContext): void {
        if (!context.world) return;
        const halfExtents = command.halfExtents;
        const mass = command.mass;
        const restitution = command.restitution;
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
            .setRestitution(restitution)
            .setMass(mass);
        const rbDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(command.x, command.y, command.z);
        const rigidBody = context.world.createRigidBody(rbDesc);
        if (command.rot) {
            rbDesc.setRotation(command.rot);
        }
        context.world.createCollider(colliderDesc, rigidBody);
        context.dynamicBodies.set(command.id, rigidBody);

    

    }
}
        