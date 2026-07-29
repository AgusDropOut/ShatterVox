import { vec3 } from "gl-matrix";
import { Debri } from "../world/Debri";

export interface GameEvents {
    "BLOCK_MINED_STATIC": { x: number, y: number, z: number };
    "BLOCK_MINED_DYNAMIC": { debri: Debri, handle: number, localX: number, localY: number, localZ: number };
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
                // ¡BLINDAJE! Evitamos que un listener roto frene la cadena de eventos
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[EventBus] Error crítico ejecutando un listener del evento '${event}':`, error);
                }
            }
        }
    }
}

export const globalEventBus = new EventBus();