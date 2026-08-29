import type { PhysicsContext } from "./PhysicsContext";
import type { WorkerToMainMsg } from "./PhysicsProtocol";
import type RAPIER from "@dimforge/rapier3d-compat";

type SpatialSoundMsg = Extract<WorkerToMainMsg, { type: 'PLAY_SPATIAL_SOUND' }>;

export class PhysicsSimulationLoop {
    private context: PhysicsContext;

    constructor(context: PhysicsContext) {
        this.context = context;
    }

    public start(): void {
        setInterval(() => this.tick(), 1000 / 60);
    }

    private tick(): void {
        if (!this.context.isInitialized || !this.context.world || !this.context.rapierEventQueue) return;
        
        this.context.world.step(this.context.rapierEventQueue);
        
        this.syncTransforms();
        this.processCollisions();
        this.syncDebugLines();
    }

    private syncTransforms(): void {
        if (this.context.dynamicBodies.size === 0) return; 

        const buffer = new Float32Array(this.context.dynamicBodies.size * 8);
        let offset = 0;

        for (const [id, body] of this.context.dynamicBodies.entries()) {
            const pos = body.translation();
            const rot = body.rotation();
            buffer[offset++] = id;
            buffer[offset++] = pos.x; buffer[offset++] = pos.y; buffer[offset++] = pos.z;
            buffer[offset++] = rot.x; buffer[offset++] = rot.y; buffer[offset++] = rot.z; buffer[offset++] = rot.w;
        }

        (self as any).postMessage({ type: 'SYNC_TRANSFORMS', buffer }, [buffer.buffer]);
    }

    private syncDebugLines(): void {
        const debug = this.context.world!.debugRender();
        const vertices = new Float32Array(debug.vertices);
        const colors = new Float32Array(debug.colors);

        (self as any).postMessage(
            { type: 'SYNC_DEBUG', vertices, colors },
            [vertices.buffer, colors.buffer]
        );
    }

    private getSpeed(col: RAPIER.Collider): number {
        const rb = col.parent();
        if (rb && rb.isDynamic()) {
            const vel = rb.linvel();
            return Math.hypot(vel.x, vel.y, vel.z);
        }
        return 0;
    }

    private processCollisions(): void {
        const soundEvents: SpatialSoundMsg[] = [];

        this.context.rapierEventQueue!.drainCollisionEvents((handle1, handle2, started) => {
            if (!started) return;
            
            const col1 = this.context.world!.getCollider(handle1);
            const col2 = this.context.world!.getCollider(handle2);
            
            let maxSpeed = 0;
            if (col1) maxSpeed = Math.max(maxSpeed, this.getSpeed(col1));
            if (col2) maxSpeed = Math.max(maxSpeed, this.getSpeed(col2));

            if (maxSpeed < 2.0) return;

            const basePos = col1 ? col1.translation() : col2!.translation();
            const volume = Math.min(maxSpeed / 15.0, 1.0);
            const pitch = 0.8 + Math.random() * 0.4;

            const material1 = this.context.colliderMaterials.get(handle1) ?? 0;
            const material2 = this.context.colliderMaterials.get(handle2) ?? 0;
            
            const soundId = this.context.blockDefs[material1]?.soundId 
                         || this.context.blockDefs[material2]?.soundId 
                         || 'stone_collision'; 
            
            soundEvents.push({ 
                type: 'PLAY_SPATIAL_SOUND',
                id: soundId,
                position: [basePos.x, basePos.y, basePos.z] as [number, number, number], 
                volume, 
                pitch
            });
        });

        if (soundEvents.length === 0) return;

        soundEvents.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
        const topSounds = soundEvents.slice(0, 3);

        for (const msg of topSounds) {
            (self as any).postMessage(msg); 
        }
    }
}