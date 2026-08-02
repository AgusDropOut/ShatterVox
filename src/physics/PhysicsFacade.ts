// src/physics/PhysicsFacade.ts
import { vec3, quat } from "gl-matrix";
import { globalEventBus } from "../core/EventBus";
import type { PhysicsCommand, WorkerToMainMsg } from "./PhysicsProtocol";

export interface TransformData {
    position: vec3;
    rotation: quat;
}

export class PhysicsFacade {
    private worker: Worker;
    public isReady: boolean = false;
    public transforms: Map<number, TransformData> = new Map();
    private nextId: number = 1;
    public debugVertices: Float32Array | null = null;
    public debugColors: Float32Array | null = null;
    private pendingRaycasts: Map<number, (res: any) => void> = new Map();
    private nextReqId: number = 1;
    

    private commandQueue: PhysicsCommand[] = []; 

    constructor() {
        this.worker = new Worker(new URL("./physics.worker.ts", import.meta.url), { type: "module" });
        this.worker.onmessage = (e: MessageEvent<WorkerToMainMsg>) => this.handleMessage(e.data);
        this.worker.onerror = (error) => {
            console.error("fatal error in physics worker:", error);
        }

        globalEventBus.on("PHYSICS_COMMAND", (command: PhysicsCommand) => {

            if (command.type === 'INIT') {
                this.worker.postMessage(command);
                return;
            }
           

            if (!this.isReady) {
                this.commandQueue.push(command);
            } else {
                this.worker.postMessage(command);
            }
        });
    }

    public generateId(): number {
        return this.nextId++;
    }

    private handleMessage(msg: WorkerToMainMsg): void {
        if (msg.type === 'INIT_DONE') {
            this.isReady = true;
            console.log(`[PhysicsFacade] Worker is ready. Flushing ${this.commandQueue.length} queued commands.`);
            
        
            for (const cmd of this.commandQueue) {
                this.worker.postMessage(cmd);
            }
            this.commandQueue = []; 
        } 
        else if (msg.type === 'SYNC_TRANSFORMS') {
            this.syncTransforms(msg.buffer);
        } 
        else if (msg.type === 'SYNC_DEBUG') {
            this.debugVertices = msg.vertices;
            this.debugColors = msg.colors;
        }
        else if (msg.type === 'RAYCAST_RESULT') {
            const resolve = this.pendingRaycasts.get(msg.reqId);
            if (resolve) {
                resolve({ 
                    hit: msg.hit, 
                    distance: msg.distance, 
                    hitId: msg.hitId,
                    localX: msg.localX,
                    localY: msg.localY,
                    localZ: msg.localZ
                });
                this.pendingRaycasts.delete(msg.reqId);
            }
        }
    }

    private syncTransforms(buffer: Float32Array): void {
        for (let i = 0; i < buffer.length; i += 8) {
            const id = buffer[i];
            
            if (!this.transforms.has(id)) {
                this.transforms.set(id, {
                    position: vec3.create(),
                    rotation: quat.create()
                });
            }

            const t = this.transforms.get(id)!;
            vec3.set(t.position, buffer[i+1], buffer[i+2], buffer[i+3]);
            quat.set(t.rotation, buffer[i+4], buffer[i+5], buffer[i+6], buffer[i+7]);
            
           
        }
    }
    public async raycast(origin: vec3, direction: vec3, maxDistance: number, excludeId: number): Promise<{hit: boolean, distance: number, hitId?: number, localX?: number, localY?: number, localZ?: number}> {
        return new Promise((resolve) => {
            const reqId = this.nextReqId++;
            this.pendingRaycasts.set(reqId, resolve);
            
            const cmd: PhysicsCommand = { type: 'RAYCAST', reqId, origin, direction, maxDistance, excludeId };
            
            if (!this.isReady) this.commandQueue.push(cmd);
            else this.worker.postMessage(cmd);
        });
    }
}