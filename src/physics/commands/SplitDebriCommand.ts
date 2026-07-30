import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class SplitDebriCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'SPLIT_DEBRI' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'SPLIT_DEBRI' }>, context: PhysicsContext): void {
        const parentBody = context.dynamicBodies.get(command.parentId);
        if (!parentBody || !context.world) return;

        const voxelSize = 0.30;
        const half = voxelSize / 2;

        const pTrans = parentBody.translation();
        const pRot = parentBody.rotation();
        const pLinVel = parentBody.linvel();
        const pAngVel = parentBody.angvel();

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pTrans.x, pTrans.y, pTrans.z)
            .setRotation(pRot)
            .setLinvel(pLinVel.x, pLinVel.y, pLinVel.z)
            .setAngvel(new RAPIER.Vector3(pAngVel.x, pAngVel.y, pAngVel.z));
        
        const newBody = context.world.createRigidBody(bodyDesc);

        const toMove = command.collidersToMove;
        for (let i = 0; i < toMove.length; i += 3) {
            const targetPx = toMove[i];
            const targetPy = toMove[i+1];
            const targetPz = toMove[i+2];

            const numColliders = parentBody.numColliders();
            for (let j = 0; j < numColliders; j++) {
                const collider = parentBody.collider(j);
                const pos = collider.translationWrtParent();
                
                if (pos && 
                    Math.abs(pos.x - targetPx) < 0.001 && 
                    Math.abs(pos.y - targetPy) < 0.001 && 
                    Math.abs(pos.z - targetPz) < 0.001) {
                    
                    context.world.removeCollider(collider, true);
                    break;
                }
            }

            const colliderDesc = RAPIER.ColliderDesc.cuboid(half, half, half)
                .setTranslation(targetPx, targetPy, targetPz);
            
            context.world.createCollider(colliderDesc, newBody);
        }

        context.dynamicBodies.set(command.newDebriId, newBody);
    }
}