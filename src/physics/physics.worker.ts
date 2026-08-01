import { PhysicsContext } from "./PhysicsContext";
import { CommandRegistry } from "./commands/CommandRegistry";
import { InitCommand } from "./commands/InitCommand";
import { CreateStaticBoxCommand } from "./commands/CreateStaticBoxCommand";
import { CreatePlayerCommand } from "./commands/CreatePlayerCommand";
import { SetPlayerVelocityCommand } from "./commands/SetPlayerVelocityCommand";
import type { PhysicsCommand } from "./PhysicsProtocol";
import { RemoveBodyCommand } from "./commands/RemoveBodyCommand";
import { CreateDebriCommand } from "./commands/CreateDebriCommand";
import { RaycastCommand } from "./commands/RaycastCommand";
import { AddTerrainCollidersCommand } from "./commands/AddTerrainCollidersCommand";
import { RemoveTerrainColliderCommand } from "./commands/RemoveTerrainColliderCommand";
import { RemoveDebriBlockCommand } from "./commands/RemoveDebriBlockCommand";
import { SplitDebriCommand } from "./commands/SplitDebriCommand";
import { ApplyImpulseCommand } from "./commands/ApplyImpulseCommand";
import { CreateDynamicBoxCommand } from "./commands/CreateDynamicBoxCommand";
import { ApplyRadialImpulseCommand } from "./commands/ApplyRadialImpulseCommand";

const context = new PhysicsContext();
const registry = new CommandRegistry();

registry.register('INIT', new InitCommand());
registry.register('CREATE_STATIC_BOX', new CreateStaticBoxCommand());
registry.register('CREATE_PLAYER', new CreatePlayerCommand());
registry.register('SET_PLAYER_VELOCITY', new SetPlayerVelocityCommand());
registry.register('CREATE_DEBRI', new CreateDebriCommand());
registry.register('REMOVE_BODY', new RemoveBodyCommand());
registry.register('RAYCAST', new RaycastCommand());
registry.register('ADD_TERRAIN_COLLIDERS', new AddTerrainCollidersCommand());
registry.register('REMOVE_TERRAIN_COLLIDER', new RemoveTerrainColliderCommand());
registry.register('REMOVE_DEBRI_BLOCK', new RemoveDebriBlockCommand());
registry.register('SPLIT_DEBRI', new SplitDebriCommand());
registry.register('APPLY_IMPULSE', new ApplyImpulseCommand());
registry.register('CREATE_DYNAMIC_BOX', new CreateDynamicBoxCommand());
registry.register('APPLY_RADIAL_IMPULSE', new ApplyRadialImpulseCommand());

self.onmessage = async (e: MessageEvent<PhysicsCommand>) => {
    const cmd = e.data;
    const handler = registry.get(cmd.type);
    if (handler) {
        await handler.execute(cmd, context);
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

    const debug = context.world.debugRender();
    
   
    const vertices = new Float32Array(debug.vertices);
    const colors = new Float32Array(debug.colors);
    
   
    (self as any).postMessage(
        { type: 'SYNC_DEBUG', vertices, colors }, 
        [vertices.buffer, colors.buffer]
    );
    
}, 1000 / 60);