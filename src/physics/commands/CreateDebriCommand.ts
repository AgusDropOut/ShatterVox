import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";
import { Engine } from "../../core/Engine";

export class CreateDebriCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'CREATE_DEBRI' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'CREATE_DEBRI' }>, context: PhysicsContext): void {
        if (!context.world) return;

        const voxelSize = Engine.voxelSize;
        const half = voxelSize / 2;
        const worldCx = command.cx * voxelSize + half;
        const worldCy = command.cy * voxelSize + half;
        const worldCz = command.cz * voxelSize + half;

        const rbDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(worldCx, worldCy, worldCz);
        const rigidBody = context.world.createRigidBody(rbDesc);

        for (const [x, y, z, blockId] of command.blocks) {
            const localX = (x - command.cx) * voxelSize;
            const localY = (y - command.cy) * voxelSize;
            const localZ = (z - command.cz) * voxelSize;
            
            const physDef = context.blockDefs[blockId] || { density: 1, friction: 0.5, restitution: 0 };

            const colliderDesc = RAPIER.ColliderDesc.cuboid(half, half, half)
                .setTranslation(localX, localY, localZ)
                .setDensity(physDef.density)
                .setFriction(physDef.friction)
                .setRestitution(physDef.restitution)
                .setRotation(command.rot ? new RAPIER.Quaternion(command.rot.x, command.rot.y, command.rot.z, command.rot.w) : new RAPIER.Quaternion(0, 0, 0, 1))
                .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
                
            const collider = context.world.createCollider(colliderDesc, rigidBody);
            context.colliderMaterials.set(collider.handle, blockId);
        }

        context.dynamicBodies.set(command.id, rigidBody);
    }
}