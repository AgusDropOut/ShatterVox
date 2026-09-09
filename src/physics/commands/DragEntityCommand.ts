import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";
import { vec3 } from "gl-matrix";

export class DragEntityCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'DRAG_ENTITY' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'DRAG_ENTITY' }>, context: PhysicsContext): void {
        const body = context.dynamicBodies.get(command.id);
        if (!body) return;

        const pos = body.translation();
        const dir = vec3.fromValues(command.targetX - pos.x, command.targetY - pos.y, command.targetZ - pos.z);
        const dist = vec3.length(dir);

        if (dist > 0.05) {
            vec3.normalize(dir, dir);
            
            let speed = dist * 8.0; 
            
        
            if (speed > 30.0) speed = 30.0;
            
            body.setLinvel({ x: dir[0] * speed, y: dir[1] * speed, z: dir[2] * speed }, true);
            
      
            const angVel = body.angvel();
            body.setAngvel({ x: angVel.x * 0.9, y: angVel.y * 0.9, z: angVel.z * 0.9 }, true);
        } else {
            body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
    }
}