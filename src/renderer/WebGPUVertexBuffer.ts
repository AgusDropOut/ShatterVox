

export class WebGPUVertexBuffer {
    public buffer: GPUBuffer;
    public byteLength: number;

    constructor(device: GPUDevice, data: Float32Array) {
        this.byteLength = data.byteLength;

        this.buffer = device.createBuffer({
            size: this.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(this.buffer, 0, data);
    }

    

    public updateData(device: GPUDevice, newData: Float32Array): void {
        if (newData.byteLength > this.byteLength) {
            this.destroy();
            this.byteLength = newData.byteLength;
            this.buffer = device.createBuffer({
                size: this.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }
        
        device.queue.writeBuffer(this.buffer, 0, newData);
    }

    public destroy(): void {
        this.buffer.destroy();
    }
}