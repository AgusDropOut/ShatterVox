// src/physics/PhysicsProtocol.ts

export type PhysicsCommand = 
    | { type: 'INIT', gravity: { x: number, y: number, z: number } }
    | { type: 'CREATE_STATIC_BOX', id: number, halfW: number, halfH: number, halfD: number, x: number, y: number, z: number }
    | { type: 'CREATE_PLAYER', id: number, x: number, y: number, z: number, radius: number, halfHeight: number }
    | { type: 'SET_PLAYER_VELOCITY', id: number, x: number, y: number, z: number }

    ;


export type WorkerToMainMsg = 
    | { type: 'INIT_DONE' }
    | { type: 'SYNC_TRANSFORMS', buffer: Float32Array };

