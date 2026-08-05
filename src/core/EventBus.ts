import type { PhysicsCommand } from "../physics/PhysicsProtocol";

export interface GameEvents {
    "BLOCK_MINED_STATIC": { x: number, y: number, z: number, radius?: number };
    "BLOCK_MINED_DYNAMIC": { debriId: number, localX: number, localY: number, localZ: number, radius?: number };
    "WINDOW_RESIZE": { width: number, height: number };
    "TOGGLE_PHYSICS_DEBUG": {}; 
    "PHYSICS_COMMAND": PhysicsCommand;
    "SYNC_TRANSFORMS": { buffer: Float32Array };
    "SPAWN_BOMB": { x: number, y: number, z: number, vx: number, vy: number, vz: number, rot: {x:number, y:number, z:number, w:number} };
    "DEBUG_DEPTH": {};
    "DEBUG_NORMALS": {};
    "DEBUG_ALBEDO": {};
}

class EventBus {
    private listeners: any = {};

    public on<K extends keyof GameEvents>(event: K, callback: (data: GameEvents[K]) => void): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    public emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
        if (this.listeners[event]) {
            for (const callback of this.listeners[event]) {
                callback(data);
            }
        }
    }
}

export const globalEventBus = new EventBus();