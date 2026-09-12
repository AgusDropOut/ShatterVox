import RAPIER from "@dimforge/rapier3d-compat";
import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class InitCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'INIT' }>> {
    
    public async execute(command: Extract<PhysicsCommand, { type: 'INIT' }>, context: PhysicsContext): Promise<void> {
        await RAPIER.init();
        
        context.world = new RAPIER.World(command.gravity);
        
        const params = context.world.integrationParameters;
        
        params.numSolverIterations = 4;
        params.numInternalPgsIterations = 1;
        params.maxCcdSubsteps = 1; 
        
        context.isInitialized = true;
        context.blockDefs = command.blockDefs;
        context.rapierEventQueue = new RAPIER.EventQueue(true);
      
        console.log("[InitCommand] Physics world initialize");
        (self as any).postMessage({ type: 'INIT_DONE' });
    }
}