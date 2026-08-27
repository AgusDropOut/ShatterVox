export class GPUTimer {
    private querySet: GPUQuerySet;
    private resolveBuffer: GPUBuffer;
    private resultBuffer: GPUBuffer;
    private passIndices: Map<string, number> = new Map();
    private passCount: number;
    public isReading: boolean = false;

    constructor(device: GPUDevice, passNames: string[]) {
        this.passCount = passNames.length;
        const queryCount = this.passCount * 2;

        this.querySet = device.createQuerySet({
            type: 'timestamp',
            count: queryCount
        });

        this.resolveBuffer = device.createBuffer({
            size: queryCount * 8,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });

        this.resultBuffer = device.createBuffer({
            size: queryCount * 8,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        passNames.forEach((name, index) => {
            this.passIndices.set(name, index * 2);
        });
    }

    public getTimestampWrites(passName: string): GPURenderPassTimestampWrites | GPUComputePassTimestampWrites | undefined {
        const startIndex = this.passIndices.get(passName);
        if (startIndex === undefined) return undefined;

        return {
            querySet: this.querySet,
            beginningOfPassWriteIndex: startIndex,
            endOfPassWriteIndex: startIndex + 1
        };
    }

    public resolve(commandEncoder: GPUCommandEncoder): void {
        if (this.isReading) return; 

        commandEncoder.resolveQuerySet(this.querySet, 0, this.passCount * 2, this.resolveBuffer, 0);
        commandEncoder.copyBufferToBuffer(this.resolveBuffer, 0, this.resultBuffer, 0, this.passCount * 16);
    }

    public async readResults(): Promise<Map<string, number> | null> {
        if (this.isReading) return null;
        this.isReading = true;

        try {
            await this.resultBuffer.mapAsync(GPUMapMode.READ);
            const arrayBuffer = this.resultBuffer.getMappedRange();
            const view = new BigInt64Array(arrayBuffer);

            const results = new Map<string, number>();
            for (const [name, startIndex] of this.passIndices.entries()) {
                const start = view[startIndex];
                const end = view[startIndex + 1];
                const durationMs = Number(end - start) / 1000000.0;
                results.set(name, durationMs);
            }

            this.resultBuffer.unmap();
            this.isReading = false;
            
            return results;
        } catch (e) {
            this.resultBuffer.unmap();
            this.isReading = false;
            return null;
        }
    }
}