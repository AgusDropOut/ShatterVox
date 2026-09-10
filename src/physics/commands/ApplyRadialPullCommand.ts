import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";
import { vec3 } from "gl-matrix";

export class ApplyRadialPullCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'APPLY_RADIAL_PULL' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'APPLY_RADIAL_PULL' }>, context: PhysicsContext): void {
        const { epicenter, radius, force } = command;
        const epiVec = vec3.fromValues(epicenter.x, epicenter.y, epicenter.z);

        for (const [id, body] of context.dynamicBodies.entries()) {
            const pos = body.translation();
            const bodyPos = vec3.fromValues(pos.x, pos.y, pos.z);
            
            const dir = vec3.create();
            vec3.subtract(dir, epiVec, bodyPos);
            
            const dist = vec3.length(dir);
            
            if (dist <= radius && dist > 0.1) {
                vec3.normalize(dir, dir);
                
             
                const strength = force * (1.0 - (dist / radius));
                
                const mass = body.mass();
                const pull = vec3.scale(vec3.create(), dir, strength * mass);

                body.applyImpulse({ x: pull[0], y: pull[1], z: pull[2] }, true);
            }
        }
    }
}