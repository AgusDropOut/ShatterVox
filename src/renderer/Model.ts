import { WebGPUVertexBuffer } from "./WebGPUVertexBuffer";

export class Model {
    public vertexCount: number = 0;
    
    private positionBuffer!: WebGPUVertexBuffer;
    private uvBuffer!: WebGPUVertexBuffer;
    private normalBuffer!: WebGPUVertexBuffer;
    private device: GPUDevice;

    constructor(device: GPUDevice) {
        this.device = device;
    }

    public uploadData(data: { positions: Float32Array, uvs: Float32Array, normals: Float32Array, vertexCount: number }): void {
        this.vertexCount = data.vertexCount;

        if (!this.positionBuffer) {
            this.positionBuffer = new WebGPUVertexBuffer(this.device, data.positions);
            this.uvBuffer = new WebGPUVertexBuffer(this.device, data.uvs);
            this.normalBuffer = new WebGPUVertexBuffer(this.device, data.normals);
        } else {
            this.positionBuffer.updateData(this.device, data.positions);
            this.uvBuffer.updateData(this.device, data.uvs);
            this.normalBuffer.updateData(this.device, data.normals);
        }
    }

    public draw(renderPass: GPURenderPassEncoder): void {
        if (this.vertexCount === 0 || !this.positionBuffer || !this.uvBuffer || !this.normalBuffer) return;
        
        renderPass.setVertexBuffer(0, this.positionBuffer.buffer);
        renderPass.setVertexBuffer(1, this.uvBuffer.buffer);
        renderPass.setVertexBuffer(2, this.normalBuffer.buffer);
        
        renderPass.draw(this.vertexCount);
    }

    public deleteGraphics(): void {
        if (this.positionBuffer) this.positionBuffer.destroy();
        if (this.uvBuffer) this.uvBuffer.destroy();
        if (this.normalBuffer) this.normalBuffer.destroy();
        this.vertexCount = 0;
    }
}