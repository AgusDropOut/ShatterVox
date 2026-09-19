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
import { RemoveTerrainBoxCommand } from "./commands/RemoveTerrainBoxCommand";
import { PhysicsSimulationLoop } from "./PhysicsSimulationLoop";
import { ApplyForceCommand } from "./commands/ApplyForceCommand";
import { DragEntityCommand } from "./commands/DragEntityCommand";
import { ApplyRadialPullCommand } from "./commands/ApplyRadialPullCommand";
import { QueryIntersectionsCommand } from "./commands/QueryIntersectionsCommand";
import { UpdateChunkCollidersCommand } from "./commands/UpdateChunkCollidersCommand";
import { EnableDebugCommand } from "./commands/EnableDebugCommand";
import { SetPositionCommand } from "./commands/SetPositionCommand";


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
registry.register('REMOVE_TERRAIN_BOX', new RemoveTerrainBoxCommand());
registry.register('APPLY_FORCE', new ApplyForceCommand());
registry.register('DRAG_ENTITY', new DragEntityCommand());
registry.register('APPLY_RADIAL_PULL', new ApplyRadialPullCommand());
registry.register('QUERY_INTERSECTIONS', new QueryIntersectionsCommand());
registry.register('UPDATE_CHUNK_COLLIDERS', new UpdateChunkCollidersCommand());
registry.register('ENABLE_DEBUG', new EnableDebugCommand());
registry.register('SET_POSITION', new SetPositionCommand());

const simulationLoop = new PhysicsSimulationLoop(context);
simulationLoop.start();

self.onmessage = async (e: MessageEvent<PhysicsCommand>) => {
    const cmd = e.data;
    const handler = registry.get(cmd.type);
    if (handler) {
        await handler.execute(cmd, context);
    }
};