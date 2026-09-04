import { GeometryGenerator } from "../geometry/GeometryGenerator";
import { Debri } from "../world/Debri";
import { WebGPUVertexBuffer } from "./WebGPUVertexBuffer";
import { Engine } from "../core/Engine";
import { mat4 } from "gl-matrix";
import { BlockRegistry } from "../block/BlockRegistry";

export class SmallDebriBatchManager {
    private device: GPUDevice;
    private storageBuffer: GPUBuffer;
    private bindGroup: GPUBindGroup;
    private vertexBuffer: WebGPUVertexBuffer;
    private normalBuffer: WebGPUVertexBuffer;

    private maxCapacity: number;
    private hostArray: Float32Array;
    private prevMatrices: Map<number, Float32Array>;
    
   
    private readonly FLOATS_PER_INSTANCE = 112;

    constructor(device: GPUDevice, layout: GPUBindGroupLayout, maxCapacity: number = 2000) {
        this.device = device;
        this.maxCapacity = maxCapacity;
        this.hostArray = new Float32Array(maxCapacity * this.FLOATS_PER_INSTANCE);
        this.prevMatrices = new Map();

        this.storageBuffer = device.createBuffer({
            size: this.hostArray.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: "Small Debri Storage Buffer"
        });

        this.vertexBuffer = new WebGPUVertexBuffer(device, GeometryGenerator.getCubePositionsScaled(Engine.voxelSize / 2));
        this.normalBuffer = new WebGPUVertexBuffer(device, GeometryGenerator.getCubeNormalsAsFloat32Array());

        this.bindGroup = device.createBindGroup({
            layout: layout,
            entries: [{ binding: 0, resource: { buffer: this.storageBuffer } }]
        });
    }

    public updateAndUploadModelMatrixesandUvs(debris: Debri[]): number {
        const count = Math.min(debris.length, this.maxCapacity);

        for (let i = 0; i < count; i++) {
            if (!debris[i].isSingleBlockMesh()) continue; 
            const baseIndex = i * this.FLOATS_PER_INSTANCE;
            const debriId = debris[i].id;

            const originalMatrix = debris[i].getModelMatrix();
            const matrix = mat4.clone(originalMatrix);

            mat4.translate(matrix, matrix, [
                Engine.voxelSize / 2, 
                Engine.voxelSize / 2, 
                Engine.voxelSize / 2
            ]);
            
            const currentFloatArray = matrix as Float32Array;
            this.hostArray.set(currentFloatArray, baseIndex);

            let prevMatrix = this.prevMatrices.get(debriId);
            if (!prevMatrix) {
                prevMatrix = new Float32Array(currentFloatArray);
                this.prevMatrices.set(debriId, prevMatrix);
            }
            this.hostArray.set(prevMatrix, baseIndex + 16);

            prevMatrix.set(currentFloatArray);
    
            const fullUVs = debris[i].getUVOffsets(); 
            this.hostArray.set(fullUVs, baseIndex + 32); 

        
            let r = 1.0, g = 1.0, b = 1.0, roughness = 0.9, metallic = 0.0;
            const blockId = debris[i].getBlock(0, 0, 0); 
            
            if (blockId !== 0) {
                const blockDef = BlockRegistry.get(blockId);
                [r, g, b] = blockDef.color;
                roughness = blockDef.roughness;
                metallic = blockDef.metallic;
            }

           
            this.hostArray[baseIndex + 104] = r;
            this.hostArray[baseIndex + 105] = g;
            this.hostArray[baseIndex + 106] = b;
            this.hostArray[baseIndex + 107] = roughness;
            
            this.hostArray[baseIndex + 108] = metallic;
            this.hostArray[baseIndex + 109] = 0.0; 
            this.hostArray[baseIndex + 110] = 0.0; 
            this.hostArray[baseIndex + 111] = 0.0; 
        }

        if (count > 0) {
            this.device.queue.writeBuffer(
                this.storageBuffer,
                0,
                this.hostArray,
                0,
                count * this.FLOATS_PER_INSTANCE
            );
        }

        return count;
    }

    public getBindGroup(): GPUBindGroup { return this.bindGroup; }
    public destroy(): void { this.storageBuffer.destroy(); }
    public getVertexBuffer(): WebGPUVertexBuffer { return this.vertexBuffer; }
    public getNormalBuffer(): WebGPUVertexBuffer { return this.normalBuffer; }
}