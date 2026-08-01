import { vec3 } from "gl-matrix";

export type PhysicsCommand = 
    | { type: 'INIT', gravity: { x: number, y: number, z: number } }
    | { type: 'CREATE_STATIC_BOX', id: number, halfW: number, halfH: number, halfD: number, x: number, y: number, z: number }
    | { type: 'CREATE_PLAYER', id: number, x: number, y: number, z: number, radius: number, halfHeight: number }
    | { type: 'SET_PLAYER_VELOCITY', id: number, x: number, z: number, jump: boolean }
    | { type: 'CREATE_DEBRI', id: number, cx: number, cy: number, cz: number, blocks: number[][] }
    | { type: 'REMOVE_BODY', id: number }
    | { type: 'RAYCAST', reqId: number, origin: vec3, direction: vec3, maxDistance: number, excludeId: number }
    | { type: 'ADD_TERRAIN_COLLIDERS', positions: Float32Array }
    | { type: 'REMOVE_TERRAIN_COLLIDER', x: number, y: number, z: number }
    | { type: 'REMOVE_DEBRI_BLOCK', id: number, localX: number, localY: number, localZ: number }
    | { type: 'SPLIT_DEBRI', parentId: number, newDebriId: number, collidersToMove: Float32Array }
    | { type: 'APPLY_IMPULSE', id: number, x: number, y: number, z: number }
    | { type: 'CREATE_DYNAMIC_BOX', id: number, x: number, y: number, z: number, rot?: {x:number, y:number, z:number, w:number}, halfExtents: { x: number, y: number, z: number }, mass: number, restitution: number }
    | { type: 'APPLY_RADIAL_IMPULSE', epicenter: { x: number, y: number, z: number }, radius: number, force: number };
export type WorkerToMainMsg = 
    | { type: 'INIT_DONE' }
    | { type: 'SYNC_TRANSFORMS', buffer: Float32Array }
    | { type: 'SYNC_DEBUG', vertices: Float32Array, colors: Float32Array }
    | { type: 'RAYCAST_RESULT', reqId: number, hit: boolean, distance: number, hitId?: number, localX?: number, localY?: number, localZ?: number };