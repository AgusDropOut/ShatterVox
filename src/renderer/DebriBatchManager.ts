import { Debri } from "../world/Debri";

export class DebriBatchManager {
    private device: GPUDevice;
    private storageBuffer: GPUBuffer;
    private bindGroup: GPUBindGroup;
    private maxCapacity: number;
    private hostArray: Float32Array;

    constructor(device: GPUDevice, layout: GPUBindGroupLayout, maxCapacity: number = 2000) {
        this.device = device;
        this.maxCapacity = maxCapacity;
        this.hostArray = new Float32Array(maxCapacity * 16);

        this.storageBuffer = device.createBuffer({
            size: this.hostArray.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: "Debri Storage Buffer"
        });

        this.bindGroup = device.createBindGroup({
            layout: layout,
            entries: [{
                binding: 0,
                resource: { buffer: this.storageBuffer }
            }]
        });
    }

    public updateAndUpload(debris: Debri[]): number {
        const count = Math.min(debris.length, this.maxCapacity);

        for (let i = 0; i < count; i++) {
            const matrix = debris[i].getModelMatrix();
            this.hostArray.set(matrix as Float32Array, i * 16);
        }

        if (count > 0) {
            this.device.queue.writeBuffer(
                this.storageBuffer,
                0,
                this.hostArray,
                0,
                count * 16
            );
        }

        return count;
    }

    public getBindGroup(): GPUBindGroup {
        return this.bindGroup;
    }

    public destroy(): void {
        this.storageBuffer.destroy();
    }
}