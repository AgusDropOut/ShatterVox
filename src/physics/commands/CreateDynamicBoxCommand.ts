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
        const materialId = (command as any).materialId ?? 0;

        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
            .setRestitution(restitution)
            .setMass(mass)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        
        const rbDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(command.x, command.y, command.z);
        
        if (command.rot) {
            rbDesc.setRotation(command.rot);
        }
        
        const rigidBody = context.world.createRigidBody(rbDesc);
        const collider = context.world.createCollider(colliderDesc, rigidBody);
        
        context.colliderMaterials.set(collider.handle, materialId);
        context.dynamicBodies.set(command.id, rigidBody);
    }
}