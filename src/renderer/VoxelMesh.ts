import { WebGPUVertexBuffer } from "./WebGPUVertexBuffer";
import type { MeshData } from "../world/ChunkMesher";

export class VoxelMesh {
    private positions: WebGPUVertexBuffer | null = null;
    private normals: WebGPUVertexBuffer | null = null;
    private colors: WebGPUVertexBuffer | null = null;
    private uvs: WebGPUVertexBuffer | null = null;
    private vertexCount: number = 0;

    public updateGraphics(device: GPUDevice, meshData: MeshData) { 
        if (meshData.vertexCount === 0) {
            this.deleteBuffers();
            return;
        }

        if (!this.positions || !this.normals || !this.colors || !this.uvs) {
            this.positions = new WebGPUVertexBuffer(device, meshData.positions);
            this.normals = new WebGPUVertexBuffer(device, meshData.normals);
            this.colors = new WebGPUVertexBuffer(device, meshData.colors);
            this.uvs = new WebGPUVertexBuffer(device, meshData.uvs);
        } else {
            this.positions.updateData(device, meshData.positions);
            this.normals.updateData(device, meshData.normals);
            this.colors.updateData(device, meshData.colors);
            this.uvs.updateData(device, meshData.uvs);
        }
        this.vertexCount = meshData.vertexCount;
    }

    public deleteBuffers() {
        if (this.positions) { this.positions.destroy(); this.positions = null; }
        if (this.normals) { this.normals.destroy(); this.normals = null; }
        if (this.colors) { this.colors.destroy(); this.colors = null; }
        if (this.uvs) { this.uvs.destroy(); this.uvs = null; }
        this.vertexCount = 0;
    }

    public draw(renderPass: GPURenderPassEncoder) { 
        if (this.vertexCount === 0 || !this.positions || !this.normals || !this.colors || !this.uvs) return;

        renderPass.setVertexBuffer(0, this.positions.buffer);
        renderPass.setVertexBuffer(1, this.normals.buffer);
        renderPass.setVertexBuffer(2, this.colors.buffer);
        renderPass.setVertexBuffer(3, this.uvs.buffer);

        renderPass.draw(this.vertexCount);
    }
}