import type { PhysicsCommand } from "../physics/PhysicsProtocol";
import {vec3, vec4} from "gl-matrix"

export interface GameEvents {
    "BLOCK_MINED_STATIC": { x: number, y: number, z: number, radius?: number };
    "BLOCK_MINED_DYNAMIC": { debriId: number, localX: number, localY: number, localZ: number, radius?: number };
    "WINDOW_RESIZE": { width: number, height: number };
    "TOGGLE_PHYSICS_DEBUG": { enabled?: boolean }; 
    "PHYSICS_COMMAND": PhysicsCommand;
    "SYNC_TRANSFORMS": { buffer: Float32Array };
    "SPAWN_BOMB": { x: number, y: number, z: number, vx: number, vy: number, vz: number, rot: {x:number, y:number, z:number, w:number} };
    "CHANGE_DEBUG_VIEW": { view: string };
    "LIGHT_ADD": { position: { x: number, y: number, z: number }, color: { r: number, g: number, b: number }, radius: number, debriId?: number, localPos?: { x: number, y: number, z: number } };
    "LIGHT_REMOVE": { position?: { x: number, y: number, z: number }, debriId?: number };
    "PLAY_SPATIAL_SOUND": { id: string, position: vec3, volume?: number, pitch?: number };
    "SPAWN_PARTICLE": { position: vec3, velocity: vec3, color: vec4, lifetime: number };
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