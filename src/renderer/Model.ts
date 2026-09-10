import { WebGPUVertexBuffer } from "./WebGPUVertexBuffer";
import type { ParsedModelData, SubMeshData } from "./ObjLoader";

export class Model {
    public vertexCount: number = 0;
    public subMeshes: SubMeshData[] = [];
    
    private positionBuffer!: WebGPUVertexBuffer;
    private uvBuffer!: WebGPUVertexBuffer;
    private normalBuffer!: WebGPUVertexBuffer;
    private device: GPUDevice;

    constructor(device: GPUDevice) {
        this.device = device;
    }

    public uploadData(data: ParsedModelData): void {
        this.vertexCount = data.vertexCount;
        this.subMeshes = data.subMeshes;

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

    public drawSubMesh(renderPass: GPURenderPassEncoder, subMesh: SubMeshData): void {
        if (this.vertexCount === 0 || !this.positionBuffer || !this.uvBuffer || !this.normalBuffer) return;

        renderPass.setVertexBuffer(0, this.positionBuffer.buffer);
        renderPass.setVertexBuffer(1, this.uvBuffer.buffer);
        renderPass.setVertexBuffer(2, this.normalBuffer.buffer);
        
        renderPass.draw(subMesh.indexCount, 1, subMesh.indexOffset, 0);
    }

    public deleteGraphics(): void {
        if (this.positionBuffer) this.positionBuffer.destroy();
        if (this.uvBuffer) this.uvBuffer.destroy();
        if (this.normalBuffer) this.normalBuffer.destroy();
        this.vertexCount = 0;
    }
}