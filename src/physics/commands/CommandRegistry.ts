import type { CommandHandler } from "./CommandHandler";
import type { PhysicsCommand } from "../PhysicsProtocol";

export class CommandRegistry {
    private handlers: Map<string, CommandHandler> = new Map();

    public register(type: PhysicsCommand['type'], handler: CommandHandler): void {
        this.handlers.set(type, handler);
    }

    public get(type: string): CommandHandler | undefined {
        return this.handlers.get(type);
    }
}