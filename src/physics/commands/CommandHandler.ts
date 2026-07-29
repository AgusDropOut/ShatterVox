import { PhysicsContext } from "../PhysicsContext";
import type { PhysicsCommand } from "../PhysicsProtocol";

export interface CommandHandler<T extends PhysicsCommand = PhysicsCommand> {
    execute(command: T, context: PhysicsContext): void | Promise<void>;
}