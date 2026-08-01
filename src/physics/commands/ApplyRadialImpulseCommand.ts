import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";
import { vec3 } from "gl-matrix";

export class ApplyRadialImpulseCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'APPLY_RADIAL_IMPULSE' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'APPLY_RADIAL_IMPULSE' }>, context: PhysicsContext): void {
        const { epicenter, radius, force } = command;
        const epiVec = vec3.fromValues(epicenter.x, epicenter.y, epicenter.z);

        for (const [id, body] of context.dynamicBodies.entries()) {
            const pos = body.translation();
            const bodyPos = vec3.fromValues(pos.x, pos.y, pos.z);
            
            const dir = vec3.create();
            vec3.subtract(dir, bodyPos, epiVec);
            
            const dist = vec3.length(dir);
            
   
            if (dist <= radius) {
         
                vec3.normalize(dir, dir);
 
                dir[1] += 0.5; 
                vec3.normalize(dir, dir);

           
                const strength = force * (1.0 - (dist / radius));
            
                const mass = body.mass();
                const impulse = vec3.scale(vec3.create(), dir, strength * mass);

                body.applyImpulse({ x: impulse[0], y: impulse[1], z: impulse[2] }, true);
            }
        }
    }
}