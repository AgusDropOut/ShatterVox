export class WebGPUUniformBuffer {
    public readonly buffer: GPUBuffer;
    private readonly device: GPUDevice;
    public readonly byteLength: number;

    constructor(device: GPUDevice, initialData: Float32Array) {
        this.device = device;
        this.byteLength = initialData.byteLength;

        this.buffer = this.device.createBuffer({
            size: this.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.buffer, 0, initialData);
    }

    public update(data: Float32Array): void {
        this.device.queue.writeBuffer(this.buffer, 0, data);
    }

    public destroy(): void {
        this.buffer.destroy();
    }
}