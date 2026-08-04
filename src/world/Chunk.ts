
import { VoxelMesh } from "../renderer/VoxelMesh";
import { WebGPUUniformBuffer } from "../renderer/WebGPUUniformBuffer";
import type { Mesheable } from "../types/Mesheable";
import type { Renderable } from "../types/Renderable";
import type { MeshData } from "./ChunkMesher"; 
import { mat4 } from "gl-matrix";

export class Chunk implements Mesheable, Renderable {
    public static readonly WIDTH = 32;
    public static readonly HEIGHT = 32;
    public static readonly DEPTH = 32;

    public readonly chunkX: number;
    public readonly chunkY: number;
    public readonly chunkZ: number;

    private readonly blocks: Uint8Array;

    private mesh: VoxelMesh;
    private modelBuffer: WebGPUUniformBuffer;
    private bindGroup: GPUBindGroup;
   

    public isDirty: boolean = false;

    constructor(device: GPUDevice, layout: GPUBindGroupLayout, chunkX: number, chunkY: number, chunkZ: number) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.chunkZ = chunkZ;
        const volume = Chunk.WIDTH * Chunk.HEIGHT * Chunk.DEPTH;
        this.blocks = new Uint8Array(volume);
        this.mesh = new VoxelMesh();
        this.modelBuffer = new WebGPUUniformBuffer(device, this.getModelMatrix() as Float32Array);
        this.bindGroup = device.createBindGroup({
            layout: layout,
            entries: [{ binding: 0, resource: { buffer: this.modelBuffer.buffer } }]
        });
    }

    public getBlock(x: number, y: number, z: number): number {
        if (!this.inBounds(x, y, z)) return 0;
        return this.blocks[this.getIndex(x, y, z)];
    }

    public setBlock(x: number, y: number, z: number, id: number): void {
        if (!this.inBounds(x, y, z)) return;
        this.blocks[this.getIndex(x, y, z)] = id;
    }


    public getBlocks(): number[] {
        return Array.from(this.blocks);
    }

    public updateGraphics(device: GPUDevice, meshData: MeshData): void {
        this.mesh.updateGraphics(device, meshData);
    }

    public getModelMatrix(): mat4 {
        const modelMatrix = mat4.create();
        return modelMatrix;
    }

    public deleteGraphics(): void {
        this.mesh.deleteBuffers();
        this.modelBuffer.destroy();
    }

    

    public draw(renderPass: GPURenderPassEncoder): void {
        renderPass.setBindGroup(1, this.bindGroup);
        this.mesh.draw(renderPass);
    }

    private getIndex(x: number, y: number, z: number): number {
        return x + (y * Chunk.WIDTH) + (z * Chunk.WIDTH * Chunk.HEIGHT);
    }

    private inBounds(x: number, y: number, z: number): boolean {
        return x >= 0 && x < Chunk.WIDTH && 
               y >= 0 && y < Chunk.HEIGHT && 
               z >= 0 && z < Chunk.DEPTH;
    }
}