import { globalEventBus } from '../core/EventBus';
import { WebGPUStorageBuffer } from './WebGPUStorageBuffer';
import { WebGPUUniformBuffer } from './WebGPUUniformBuffer';


export interface Light {
    id: number;
    position: { x: number; y: number; z: number };
    color: { r: number; g: number; b: number };
    radius: number;
    debriId?: number;
}

export interface LightInfo{
    position: { x: number; y: number; z: number };
    color: { r: number; g: number; b: number };
    radius: number;
    debriId?: number;
}

export class LightManager {
    private lights: Map<number, Light> = new Map();

    private readonly maxLights: number = 200;

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
        this.lightBuffer = new WebGPUStorageBuffer(device, new Float32Array(this.maxLights  * this.floatsPerLight));
        this.lightAmountBuffer = new WebGPUUniformBuffer(device, new Float32Array([0.0, 0.0, 0.0, 0.0])); // 4 floats for alignment 1 for light count and 3 for padding

        this.lightBindGroup = device.createBindGroup({
            layout: this.lightBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.lightBuffer.buffer } },
                { binding: 1, resource: { buffer: this.lightAmountBuffer.buffer } }
            ]
        });


        globalEventBus.on('LIGHT_ADD', (light: LightInfo) => this.addLight(light));
        globalEventBus.on('LIGHT_REMOVE', (data: { position: { x: number, y: number, z: number }, debriId?: number }) => this.removeLight(data.position, data.debriId)); 
    }

    private addLight(light: LightInfo): void {
        if (this.lights.size >= this.maxLights) {
            console.warn('Maximum number of lights reached');
            return;
        }

        console.log(`Adding light at position (${light.position.x}, ${light.position.y}, ${light.position.z}) with color (${light.color.r}, ${light.color.g}, ${light.color.b}) and radius ${light.radius}`);
        const newLight: Light = {
            id: this.nextLightId++,
            position: light.position,
            color: light.color,
            radius: light.radius,
            debriId: light.debriId
        };
        this.lights.set(newLight.id, newLight);
    }

    public updateLightBuffer(): void {
        const lightData = new Float32Array(this.maxLights * this.floatsPerLight);
        let index = 0;
        this.lightAmount = 0;
        for (const [id, light] of this.lights.entries()) {
            lightData[index++] = light.position.x;
            lightData[index++] = light.position.y;
            lightData[index++] = light.position.z;
            lightData[index++] = light.radius;
            lightData[index++] = light.color.r;
            lightData[index++] = light.color.g;
            lightData[index++] = light.color.b; 
            lightData[index++] = 0.0;
            this.lightAmount++;
        }

        this.lightBuffer.update(lightData);
        this.lightAmountBuffer.update(new Float32Array([this.lightAmount, 0.0, 0.0, 0.0])); 
        console.log(`Updated light buffer with ${this.lightAmount} lights`);
    }


    private removeLight(position: { x: number, y: number, z: number }, debriId?: number): void {
        for (const [id, light] of this.lights.entries()) {
            if (light.position.x === position.x && light.position.y === position.y && light.position.z === position.z && (light.debriId === debriId || debriId === undefined)) {
                this.lights.delete(id);
                return;
            }
        }
        console.warn('Light not found');
    }

    public getBindGroup(): GPUBindGroup {
        return this.lightBindGroup;
    }

}