import type { CommandHandler } from "./CommandHandler";
import type { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";


export class EnableDebugCommand implements CommandHandler<Extract<PhysicsCommand, { type: 'ENABLE_DEBUG' }>> {
    public execute(command: Extract<PhysicsCommand, { type: 'ENABLE_DEBUG' }>, context: PhysicsContext): void {
        context.debugEnabled = !context.debugEnabled;
    }
}