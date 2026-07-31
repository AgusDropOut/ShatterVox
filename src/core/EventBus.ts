import type { PhysicsCommand } from "../physics/PhysicsProtocol";

export interface GameEvents {
    "BLOCK_MINED_STATIC": { x: number, y: number, z: number, radius?: number };
    "BLOCK_MINED_DYNAMIC": { debriId: number, localX: number, localY: number, localZ: number };
    "WINDOW_RESIZE": { width: number, height: number };
    "TOGGLE_PHYSICS_DEBUG": {}; 
    "PHYSICS_COMMAND": PhysicsCommand;
    "SYNC_TRANSFORMS": { buffer: Float32Array };
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