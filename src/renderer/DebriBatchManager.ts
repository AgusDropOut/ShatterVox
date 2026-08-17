import { Debri } from "../world/Debri";

export class DebriBatchManager {
    private device: GPUDevice;
    private storageBuffer: GPUBuffer;
    private bindGroup: GPUBindGroup;
    private maxCapacity: number;
    private hostArray: Float32Array;
    private prevMatrices: Map<number, Float32Array>;
    private readonly FLOATS_PER_INSTANCE = 32; 

    constructor(device: GPUDevice, layout: GPUBindGroupLayout, maxCapacity: number = 2000) {
        this.device = device;
        this.maxCapacity = maxCapacity;
        this.hostArray = new Float32Array(maxCapacity * this.FLOATS_PER_INSTANCE);
        this.prevMatrices = new Map();

        this.storageBuffer = device.createBuffer({
            size: this.hostArray.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: "Debri Storage Buffer"
        });

        this.bindGroup = device.createBindGroup({
            layout: layout,
            entries: [{ binding: 0, resource: { buffer: this.storageBuffer } }]
        });
    }

    public updateAndUploadModelMatrixes(debris: Debri[]): number {
        const count = Math.min(debris.length, this.maxCapacity);

        for (let i = 0; i < count; i++) {
            const debriId = debris[i].id;
            const currentMatrix = debris[i].getModelMatrix() as Float32Array;
            const baseIndex = i * this.FLOATS_PER_INSTANCE;

           
            this.hostArray.set(currentMatrix, baseIndex);

          
            let prevMatrix = this.prevMatrices.get(debriId);
            if (!prevMatrix) {
                prevMatrix = new Float32Array(currentMatrix);
                this.prevMatrices.set(debriId, prevMatrix);
            }
            this.hostArray.set(prevMatrix, baseIndex + 16);

        
            prevMatrix.set(currentMatrix);
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
}