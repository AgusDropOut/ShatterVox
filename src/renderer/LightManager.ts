import { globalEventBus } from '../core/EventBus';
import { WebGPUStorageBuffer } from './WebGPUStorageBuffer';
import { WebGPUUniformBuffer } from './WebGPUUniformBuffer';
import { vec3, mat4 } from 'gl-matrix'; 
import type { PhysicsFacade } from '../physics/PhysicsFacade'; 

export interface Light {
    id: number;
    position: vec3;
    color: vec3;
    radius: number;
    debriId?: number;
    localPos?: vec3; 
}

export interface LightInfo {
    position: { x: number; y: number; z: number };
    color: { r: number; g: number; b: number };
    radius: number;
    debriId?: number;
    localPos?: { x: number; y: number; z: number }; 
}

export class LightManager {
    private lights: Map<number, Light> = new Map();
    private readonly maxLights: number = 2000;
    private nextLightId: number = 0;
    private readonly floatsPerLight: number = 8;
    
    private lightBuffer: WebGPUStorageBuffer;
    private lightAmountBuffer: WebGPUUniformBuffer;
    private lightAmount: number = 0;
    
    private readonly device: GPUDevice;
    private readonly lightBindGroup: GPUBindGroup;
    private readonly lightBindGroupLayout: GPUBindGroupLayout;

    constructor(device: GPUDevice, layout: GPUBindGroupLayout) {
        this.device = device;
        this.lightBindGroupLayout = layout;
        
        this.lightBuffer = new WebGPUStorageBuffer(device, new Float32Array(this.maxLights * this.floatsPerLight));
        this.lightAmountBuffer = new WebGPUUniformBuffer(device, new Float32Array([0.0, 0.0, 0.0, 0.0])); 

        this.lightBindGroup = device.createBindGroup({
            layout: this.lightBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.lightBuffer.buffer } },
                { binding: 1, resource: { buffer: this.lightAmountBuffer.buffer } }
            ]
        });

        globalEventBus.on('LIGHT_ADD', (light: LightInfo) => this.addLight(light));
        
        globalEventBus.on('LIGHT_REMOVE', (data: { position?: { x: number, y: number, z: number }, debriId?: number }) => {
            if (data.debriId !== undefined && data.position === undefined) {
                this.removeDebriLights(data.debriId);
            } else if (data.position) {
                this.removeLight(data.position, data.debriId);
            }
        });
    }

    private addLight(light: LightInfo): void {
        if (this.lights.size >= this.maxLights) {
            let oldestId = -1;
            for (const id of this.lights.keys()) {
                if (oldestId === -1 || id < oldestId) {
                    oldestId = id;
                }
            }
            if (oldestId !== -1) {
                this.lights.delete(oldestId);
            }
        }

        const newLight: Light = {
            id: this.nextLightId++,
            position: vec3.fromValues(light.position.x, light.position.y, light.position.z),
            color: vec3.fromValues(light.color.r, light.color.g, light.color.b),
            radius: light.radius,
            debriId: light.debriId,
            localPos: light.localPos ? vec3.fromValues(light.localPos.x, light.localPos.y, light.localPos.z) : undefined 
        };
        
        this.lights.set(newLight.id, newLight);
    }

    public updateDynamicLights(physicsFacade: PhysicsFacade): void {
        for (const light of this.lights.values()) {
            if (light.debriId !== undefined && light.localPos) {
                const transform = physicsFacade.transforms.get(light.debriId);
                
                if (transform) {
                    const modelMatrix = mat4.create();
                    mat4.fromRotationTranslation(modelMatrix, transform.rotation, transform.position);
                    vec3.transformMat4(light.position, light.localPos, modelMatrix);
                }
            }
        }
    }

    public updateLightBuffer(): void {
        const lightData = new Float32Array(this.maxLights * this.floatsPerLight);
        let index = 0;
        this.lightAmount = 0;
        
        for (const light of this.lights.values()) {
            lightData[index++] = light.position[0];
            lightData[index++] = light.position[1];
            lightData[index++] = light.position[2];
            lightData[index++] = light.radius;
            lightData[index++] = light.color[0];
            lightData[index++] = light.color[1];
            lightData[index++] = light.color[2]; 
            lightData[index++] = 0.0;
            
            this.lightAmount++;
        }

        this.lightBuffer.update(lightData);
        this.lightAmountBuffer.update(new Float32Array([this.lightAmount, 0.0, 0.0, 0.0])); 
    }

    private removeLight(position: { x: number, y: number, z: number }, debriId?: number): void {
        const targetPos = vec3.fromValues(position.x, position.y, position.z);
        const sqrEpsilon = 0.0001; 

        for (const [id, light] of this.lights.entries()) {
            if (debriId !== undefined) {
                if (light.debriId === debriId && light.localPos) {
                    if (vec3.sqrDist(light.localPos, targetPos) < sqrEpsilon) {
                        this.lights.delete(id);
                        return;
                    }
                }
            } else {
                if (light.debriId === undefined) {
                    if (vec3.sqrDist(light.position, targetPos) < sqrEpsilon) {
                        this.lights.delete(id);
                        return;
                    }
                }
            }
        }
    }

    private removeDebriLights(debriId: number): void {
        for (const [id, light] of this.lights.entries()) {
            if (light.debriId === debriId) {
                this.lights.delete(id);
            }
        }
    }

    public getBindGroup(): GPUBindGroup {
        return this.lightBindGroup;
    }
}