import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class RemoveTerrainBoxCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'REMOVE_TERRAIN_BOX' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'REMOVE_TERRAIN_BOX' }>, context: PhysicsContext): void {
        if (!context.world || !context.terrainCollidersMap) return;
        
        const collider = context.terrainCollidersMap.get(command.id);
        if (collider) {
            context.colliderMaterials.delete(collider.handle);
            context.world.removeCollider(collider, false);
            context.terrainCollidersMap.delete(command.id);
        } else {
            console.warn(`No terrain collider found with ID ${command.id} to remove.`);
        }
    }
}