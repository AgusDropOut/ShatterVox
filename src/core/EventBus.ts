import type { PhysicsCommand } from "../physics/PhysicsProtocol";
import { vec3, vec4 } from "gl-matrix";

export interface GameEvents {
    "BLOCK_MINED_STATIC": { x: number, y: number, z: number, radius?: number, blockType?: number };
    "BLOCK_MINED_DYNAMIC": { debriId: number, localX: number, localY: number, localZ: number, radius?: number };
    "WINDOW_RESIZE": { width: number, height: number };
    "TOGGLE_PHYSICS_DEBUG": { enabled?: boolean }; 
    "PHYSICS_COMMAND": PhysicsCommand;
    "SYNC_TRANSFORMS": { buffer: Float32Array };
    "BOMB_DETONATED": { x: number, y: number, z: number, radius: number };
    "CHANGE_DEBUG_VIEW": { view: string };
    "LIGHT_ADD": { position: { x: number, y: number, z: number }, color: { r: number, g: number, b: number }, radius: number, debriId?: number, localPos?: { x: number, y: number, z: number } };
    "LIGHT_REMOVE": { position?: { x: number, y: number, z: number }, debriId?: number };
    "PLAY_SPATIAL_SOUND": { id: string, position: vec3, volume?: number, pitch?: number };
    "SPAWN_PARTICLE": { position: vec3, velocity: vec3, color: vec4, lifetime: number, size: number, gravity?: boolean };
    "SPAWN_ENTITY": { modelId: string, bodyId?: number, x: number, y: number, z: number, vx?: number, vy?: number, vz?: number, rot?: any };
    "REMOVE_ENTITY_BY_BODY": { bodyId: number };
    "TOGGLE_BUILD_MODE": { enabled?: boolean }; 
    "SET_BUILD_BLOCK": { id: number };
    "SET_BUILD_TOOL": { tool: string };
    "SET_SPHERE_RADIUS": { radius: number };
    "SET_TOOL_SETTINGS": { destructionRadius?: number, buildCooldownMs?: number, mineCooldownMs?: number };
    "SHOW_OVERLAY": { data: any };
}

class EventBus {
    private listeners: Partial<Record<keyof GameEvents, Array<(data: any) => void>>> = {};

    public on<K extends keyof GameEvents>(event: K, callback: (data: GameEvents[K]) => void): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event]!.push(callback);
    }

    public emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
        const callbacks = this.listeners[event];
        if (callbacks) {
            for (let i = 0; i < callbacks.length; i++) {
                callbacks[i](data);
            }
        }
    }
}

export const globalEventBus = new EventBus();