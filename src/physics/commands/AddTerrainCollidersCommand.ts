import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";
import { Engine } from "../../core/Engine";

export class AddTerrainCollidersCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'ADD_TERRAIN_COLLIDERS' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'ADD_TERRAIN_COLLIDERS' }>, context: PhysicsContext): void {
        if (!context.world) return;
        
        if (!context.terrainRigidBody) {
            context.terrainRigidBody = context.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0));
        }

        const voxelSize = Engine.voxelSize;
        const half = voxelSize / 2;
        const pos = command.positions;
        
        for (let i = 0; i < pos.length; i += 3) {
            const x = pos[i];
            const y = pos[i+1];
            const z = pos[i+2];
            
            const colliderDesc = RAPIER.ColliderDesc.cuboid(half, half, half)
                .setTranslation(x * voxelSize + half, y * voxelSize + half, z * voxelSize + half);
            
            const collider = context.world.createCollider(colliderDesc, context.terrainRigidBody);
            context.terrainColliders.set(`${x},${y},${z}`, collider);
        }
    }
}