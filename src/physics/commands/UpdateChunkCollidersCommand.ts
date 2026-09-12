import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class UpdateChunkCollidersCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'UPDATE_CHUNK_COLLIDERS' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'UPDATE_CHUNK_COLLIDERS' }>, context: PhysicsContext): void {
        if (!context.world) return;
        
        if (!context.terrainRigidBody) {
            context.terrainRigidBody = context.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0));
        }

        
        if (!context.chunkCollidersMap) {
            context.chunkCollidersMap = new Map<string, RAPIER.Collider[]>();
        }

        const oldColliders = context.chunkCollidersMap.get(command.chunkKey);
        if (oldColliders) {
            for (const col of oldColliders) {
                context.world.removeCollider(col, false);
                context.colliderMaterials.delete(col.handle);
            }
        }

        const data = command.colliderData;
        const newColliders: RAPIER.Collider[] = [];

        for (let i = 0; i < data.length; i += 6) {
            const x = data[i];
            const y = data[i+1];
            const z = data[i+2];
            const hw = data[i+3];
            const hh = data[i+4];
            const hd = data[i+5];

            const colliderDesc = RAPIER.ColliderDesc.cuboid(hw, hh, hd)
                .setTranslation(x, y, z)
                .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
            
            const collider = context.world.createCollider(colliderDesc, context.terrainRigidBody);
            context.colliderMaterials.set(collider.handle, 0);
            newColliders.push(collider);
        }

     
        context.chunkCollidersMap.set(command.chunkKey, newColliders);
    }
}