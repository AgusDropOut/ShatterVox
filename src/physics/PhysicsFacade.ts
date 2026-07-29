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

    constructor() {
        this.worker = new Worker(new URL("./physics.worker.ts", import.meta.url), { type: "module" });
        this.worker.onmessage = (e: MessageEvent<WorkerToMainMsg>) => this.handleMessage(e.data);

  
        globalEventBus.on("PHYSICS_COMMAND", (command: PhysicsCommand) => {
            this.worker.postMessage(command);
        });
    }

    public generateId(): number {
        return this.nextId++;
    }

    private handleMessage(msg: WorkerToMainMsg): void {
        if (msg.type === 'INIT_DONE') {
            this.isReady = true;
            console.log("[PhysicsFacade] Physics worker initialized and ready.");
        } 
        else if (msg.type === 'SYNC_TRANSFORMS') {
            this.syncTransforms(msg.buffer);
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
}