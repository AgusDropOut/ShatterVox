export class WebGPUStorageBuffer {
    public readonly buffer: GPUBuffer;
    private readonly device: GPUDevice;
    public readonly byteLength: number;

    constructor(device: GPUDevice, initialData: Float32Array, label?: string) {
        this.device = device;
        this.byteLength = initialData.byteLength;

        this.buffer = this.device.createBuffer({
            label: label || "WebGPU Storage Buffer",
            size: this.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.buffer, 0, initialData);
    }


    public update(data: Float32Array): void {
        this.device.queue.writeBuffer(this.buffer, 0, data);
    }

    public updateSubData(data: Float32Array, offset: number): void {
        this.device.queue.writeBuffer(this.buffer, offset, data);
    }

    public destroy(): void {
        this.buffer.destroy();
    }
}