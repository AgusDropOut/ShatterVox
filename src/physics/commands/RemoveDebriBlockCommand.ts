import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class RemoveDebriBlockCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'REMOVE_DEBRI_BLOCK' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'REMOVE_DEBRI_BLOCK' }>, context: PhysicsContext): void {
        const body = context.dynamicBodies.get(command.id);
        if (!body || !context.world) return;

        const numColliders = body.numColliders();
        
        for (let i = 0; i < numColliders; i++) {
            const collider = body.collider(i);
            const pos = collider.translationWrtParent();
            if (!pos) continue;
            
            if (Math.abs(pos.x - command.localX) < 0.001 && 
                Math.abs(pos.y - command.localY) < 0.001 && 
                Math.abs(pos.z - command.localZ) < 0.001) {
                
                context.colliderMaterials.delete(collider.handle);
                context.world.removeCollider(collider, true);
                break; 
            }
        }
    }
}