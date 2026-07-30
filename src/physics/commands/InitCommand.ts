import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";


export class InitCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'INIT' }>> {
    
    public async execute(command: Extract<PhysicsCommand, { type: 'INIT' }>, context: PhysicsContext): Promise<void> {
        await RAPIER.init();
        context.world = new RAPIER.World(command.gravity);
        context.world.integrationParameters.numSolverIterations = 2;
        context.isInitialized = true;
        console.log("[InitCommand] Physics world initialized with gravity:", command.gravity);
    
        (self as any).postMessage({ type: 'INIT_DONE' });
    }
}