import { PhysicsContext } from "./PhysicsContext";
import { CommandRegistry } from "./commands/CommandRegistry";
import { InitCommand } from "./commands/InitCommand";
import { CreateStaticBoxCommand } from "./commands/CreateStaticBoxCommand";
import type { PhysicsCommand } from "./PhysicsProtocol";


const context = new PhysicsContext();
const registry = new CommandRegistry();

registry.register('INIT', new InitCommand());
registry.register('CREATE_STATIC_BOX', new CreateStaticBoxCommand());

self.onmessage = async (e: MessageEvent<PhysicsCommand>) => {
    const cmd = e.data;
    const handler = registry.get(cmd.type);
    
    if (handler) {
        await handler.execute(cmd, context);
    } else {
        console.warn(`[PhysicsWorker] command not recognized or without handler: ${cmd.type}`);
    }
};


setInterval(() => {
    if (!context.isInitialized || !context.world) return;

    context.world.step();

    if (context.dynamicBodies.size === 0) return; 

    const buffer = new Float32Array(context.dynamicBodies.size * 8);
    let offset = 0;

    for (const [id, body] of context.dynamicBodies.entries()) {
        const pos = body.translation();
        const rot = body.rotation();

        buffer[offset++] = id;
        buffer[offset++] = pos.x; buffer[offset++] = pos.y; buffer[offset++] = pos.z;
        buffer[offset++] = rot.x; buffer[offset++] = rot.y; buffer[offset++] = rot.z; buffer[offset++] = rot.w;
    }

   
      
    (self as any).postMessage({ type: 'SYNC_TRANSFORMS', buffer }, [buffer.buffer]);
    
}, 1000 / 60);