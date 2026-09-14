import type { PhysicsContext } from "./PhysicsContext";
import type { WorkerToMainMsg } from "./PhysicsProtocol";
import type RAPIER from "@dimforge/rapier3d-compat";

type SpatialSoundMsg = Extract<WorkerToMainMsg, { type: 'PLAY_SPATIAL_SOUND' }>;

export class PhysicsSimulationLoop {
    private context: PhysicsContext;
    private lastReportTime: number = performance.now();
    private historyBuffer: number[] = [];
    

    private soundCooldowns: Map<number, number> = new Map();

    constructor(context: PhysicsContext) {
        this.context = context;
    }

    public start(): void {
        setInterval(() => this.tick(), 1000 / 60);
    }

    private tick(): void {
        if (!this.context.isInitialized || !this.context.world || !this.context.rapierEventQueue) return;

        const start = performance.now();
        this.context.world.step(this.context.rapierEventQueue);
        const elapsed = performance.now() - start;

        this.historyBuffer.push(elapsed);
        if (this.historyBuffer.length > 60) {
            this.historyBuffer.shift();
        }

        const now = performance.now();
        if (now - this.lastReportTime >= 100) {
            (self as any).postMessage({
                type: 'PHYSICS_PROFILE_DATA',
                stepTimeMs: elapsed,
                history: [...this.historyBuffer]
            });
            this.lastReportTime = now;
        }

        this.syncTransforms();
        this.processCollisions(now);
        
        if (this.context.debugEnabled) {
            this.syncDebugLines();
        }
        
    
        for (const [handle, time] of this.soundCooldowns.entries()) {
            if (now - time > 100) { 
                this.soundCooldowns.delete(handle);
            }
        }
    }

    private syncTransforms(): void {
        if (this.context.dynamicBodies.size === 0) return; 

        let activeCount = 0;
        for (const body of this.context.dynamicBodies.values()) {
            if (!body.isSleeping()) {
                activeCount++;
            }
        }

        if (activeCount === 0) return;

        const buffer = new Float32Array(activeCount * 8);
        let offset = 0;

        for (const [id, body] of this.context.dynamicBodies.entries()) {
            if (body.isSleeping()) continue; 

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

    private processCollisions(now: number): void {
        const soundEvents: SpatialSoundMsg[] = [];
        
    
        const soundsThisFrame: Set<string> = new Set();

        this.context.rapierEventQueue!.drainCollisionEvents((handle1, handle2, started) => {
            if (!started) return;
            
         
            const t1 = this.soundCooldowns.get(handle1);
            const t2 = this.soundCooldowns.get(handle2);
            if ((t1 && now - t1 < 100) || (t2 && now - t2 < 100)) return;

            const col1 = this.context.world!.getCollider(handle1);
            const col2 = this.context.world!.getCollider(handle2);
            
            let maxSpeed = 0;
            if (col1) maxSpeed = Math.max(maxSpeed, this.getSpeed(col1));
            if (col2) maxSpeed = Math.max(maxSpeed, this.getSpeed(col2));

          
            if (maxSpeed < 1.0) return;

            const basePos = col1 ? col1.translation() : col2!.translation();
            
           
            const volume = Math.max(0.1, Math.min(maxSpeed / 15.0, 1.0)); 
            const pitch = 0.8 + Math.random() * 0.4;

            const material1 = this.context.colliderMaterials.get(handle1) ?? 0;
            const material2 = this.context.colliderMaterials.get(handle2) ?? 0;
            
            const soundId = this.context.blockDefs[material1]?.soundId 
                         || this.context.blockDefs[material2]?.soundId 
                         || 'stone_collision'; 
            
            if (soundsThisFrame.has(soundId)) return;
            soundsThisFrame.add(soundId);

            this.soundCooldowns.set(handle1, now);
            this.soundCooldowns.set(handle2, now);

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
        
      
        const topSounds = soundEvents.slice(0, 5);

        for (const msg of topSounds) {
            (self as any).postMessage(msg); 
        }
    }
}