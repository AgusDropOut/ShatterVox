import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class RemoveTerrainColliderCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'REMOVE_TERRAIN_COLLIDER' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'REMOVE_TERRAIN_COLLIDER' }>, context: PhysicsContext): void {
        if (!context.world) return;
        
        const key = `${command.x},${command.y},${command.z}`;
        const collider = context.terrainColliders.get(key);
        
        if (collider) {
            context.colliderMaterials.delete(collider.handle);
            context.world.removeCollider(collider, true);
            context.terrainColliders.delete(key);
        } else {
            console.warn(`No terrain collider found at (${command.x}, ${command.y}, ${command.z}) to remove.`);
        }
    }
}