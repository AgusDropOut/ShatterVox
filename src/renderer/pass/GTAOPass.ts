import { makeShaderDataDefinitions, makeStructuredView, type StructuredView } from "webgpu-utils";
import { InitialGTAOComputeShaderWGSL } from "../shaders/InitialGTAOComputeShader.wgsl";
import { GTAOBlurComputeShaderWGSL } from "../shaders/GTAOBlurComputeShader.wgsl";

export class GTAOPass {
    private device: GPUDevice;
    private computePipeline!: GPUComputePipeline;
    private blurPipeline!: GPUComputePipeline;

    private noisyTexture!: GPUTexture;
    private blurredTexture!: GPUTexture;
    public noisyView!: GPUTextureView;
    public blurredView!: GPUTextureView;

    private paramsBuffer!: GPUBuffer;
    private paramsView!: StructuredView;

    private computeBindGroup!: GPUBindGroup;
    private computeMatrixesBindGroup!: GPUBindGroup;
    private blurBindGroup!: GPUBindGroup;
    private blurParamsBindGroup!: GPUBindGroup;

    constructor(device: GPUDevice) {
        this.device = device;
        this.initPipelines();
        this.initBuffers();
    }

    private initPipelines(): void {
        this.computePipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: this.device.createShaderModule({ code: InitialGTAOComputeShaderWGSL }), entryPoint: 'main' }
        });
        this.blurPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: this.device.createShaderModule({ code: GTAOBlurComputeShaderWGSL }), entryPoint: 'main' }
        });
    }

    private initBuffers(): void {
        const defs = makeShaderDataDefinitions(`
            struct GTAOParams {
                screenResolution: vec2<f32>,
                zNear: f32,
                zFar: f32,
                inverseProjectionMatrix: mat4x4<f32>,
                projectionMatrix: mat4x4<f32>,
                viewMatrix: mat4x4<f32>,
            };
        `);
        this.paramsView = makeStructuredView(defs.structs.GTAOParams);
        this.paramsBuffer = this.device.createBuffer({
            size: this.paramsView.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    public resize(width: number, height: number, depthView: GPUTextureView, normalView: GPUTextureView, nearestSampler: GPUSampler): void {
        if (this.noisyTexture) this.noisyTexture.destroy();
        if (this.blurredTexture) this.blurredTexture.destroy();

        this.noisyTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.noisyView = this.noisyTexture.createView();

        this.blurredTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.blurredView = this.blurredTexture.createView();

        this.computeBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: nearestSampler },
                { binding: 1, resource: normalView },
                { binding: 2, resource: depthView },
                { binding: 3, resource: this.noisyView }
            ]
        });

        this.computeMatrixesBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.paramsBuffer } }]
        });

        this.blurBindGroup = this.device.createBindGroup({
            layout: this.blurPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: depthView },
                { binding: 1, resource: this.noisyView },
                { binding: 2, resource: this.blurredView }
            ]
        });

        this.blurParamsBindGroup = this.device.createBindGroup({
            layout: this.blurPipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.paramsBuffer } }]
        });
    }

    public updateParams(width: number, height: number, viewMatrix: Float32Array, projMatrix: Float32Array, invProjMatrix: Float32Array, zNear: number, zFar: number): void {
        this.paramsView.set({
            screenResolution: [width, height],
            zNear: zNear,
            zFar: zFar,
            inverseProjectionMatrix: invProjMatrix,
            projectionMatrix: projMatrix,
            viewMatrix: viewMatrix,
        });
        this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsView.arrayBuffer);
    }

    public compute(commandEncoder: GPUCommandEncoder, width: number, height: number): void {
        const groupsX = Math.ceil(width / 8);
        const groupsY = Math.ceil(height / 8);

        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        computePass.setBindGroup(1, this.computeMatrixesBindGroup);
        computePass.dispatchWorkgroups(groupsX, groupsY, 1);
        computePass.end();

        const blurPass = commandEncoder.beginComputePass();
        blurPass.setPipeline(this.blurPipeline);
        blurPass.setBindGroup(0, this.blurBindGroup);
        blurPass.setBindGroup(1, this.blurParamsBindGroup);
        blurPass.dispatchWorkgroups(groupsX, groupsY, 1);
        blurPass.end();
    }

    public getResultView(): GPUTextureView {
        return this.blurredView;
    }
}