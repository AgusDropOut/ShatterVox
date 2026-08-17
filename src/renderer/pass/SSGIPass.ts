import { makeShaderDataDefinitions, makeStructuredView, type StructuredView } from "webgpu-utils";
import { SSGIComputeShaderWGSL } from "../shaders/SSGIComputeShader.wgsl";
import { SSGISpatialBlurComputeShaderWGSL } from "../shaders/SSGISpatialBlurComputeShader.wgsl";

export class SSGIPass {
    private device: GPUDevice;
    private computePipeline!: GPUComputePipeline;
    private blurPipeline!: GPUComputePipeline;

    private noisyTexture!: GPUTexture;
    private blurredTexture!: GPUTexture;
    public noisyView!: GPUTextureView;
    public blurredView!: GPUTextureView;

    private ssgiParamsBuffer!: GPUBuffer;
    private ssgiParamsView!: StructuredView;
    private blurredParamsBuffer!: GPUBuffer;
    private blurredParamsView!: StructuredView;

    private computeSamplersBindGroup!: GPUBindGroup;
    private computeTexturesBindGroup!: GPUBindGroup;
    private computeParamsBindGroup!: GPUBindGroup;
    private blurTexturesBindGroup!: GPUBindGroup;
    private blurParamsBindGroup!: GPUBindGroup;

    constructor(device: GPUDevice) {
        this.device = device;
        this.initPipelines();
        this.initBuffers();
    }

    private initPipelines(): void {
        this.computePipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: this.device.createShaderModule({ code: SSGIComputeShaderWGSL }), entryPoint: 'main' }
        });
        this.blurPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: this.device.createShaderModule({ code: SSGISpatialBlurComputeShaderWGSL }), entryPoint: 'main' }
        });
    }

    private initBuffers(): void {
        const ssgiDefs = makeShaderDataDefinitions(`
            struct SSGIParams {
                projectionMatrix: mat4x4<f32>,
                inverseProjectionMatrix: mat4x4<f32>,
                inverseViewMatrix: mat4x4<f32>,
                viewMatrix: mat4x4<f32>,
                screenResolution: vec2<f32>,
                rayStepSize: f32,
                maxSteps: u32,
                thickness: f32,
                frameCounter: u32,
            };
        `);
        this.ssgiParamsView = makeStructuredView(ssgiDefs.structs.SSGIParams);
        this.ssgiParamsBuffer = this.device.createBuffer({
            size: this.ssgiParamsView.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const blurDefs = makeShaderDataDefinitions(`
            struct blurredSSGIParams {
                normalSharpness: f32,
                depthSharpness: f32,
                blurRadius: f32,
                screenResolution: vec2<f32>,
                zNear: f32,
                zFar: f32,
            };
        `);
        this.blurredParamsView = makeStructuredView(blurDefs.structs.blurredSSGIParams);
        this.blurredParamsBuffer = this.device.createBuffer({
            size: this.blurredParamsView.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    public resize(width: number, height: number, depthView: GPUTextureView, normalView: GPUTextureView, deferredView: GPUTextureView, linearSampler: GPUSampler, nearestSampler: GPUSampler): void {
        if (this.noisyTexture) this.noisyTexture.destroy();
        if (this.blurredTexture) this.blurredTexture.destroy();

        this.noisyTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.noisyView = this.noisyTexture.createView();

        this.blurredTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.blurredView = this.blurredTexture.createView();

        this.computeSamplersBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: linearSampler },
                { binding: 1, resource: nearestSampler }
            ]
        });

        this.computeTexturesBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(1),
            entries: [
                { binding: 0, resource: depthView },
                { binding: 1, resource: normalView },
                { binding: 2, resource: deferredView },
                { binding: 3, resource: this.noisyView }
            ]
        });

        this.computeParamsBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(2),
            entries: [{ binding: 0, resource: { buffer: this.ssgiParamsBuffer } }]
        });

        this.blurTexturesBindGroup = this.device.createBindGroup({
            layout: this.blurPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: depthView },
                { binding: 1, resource: normalView },
                { binding: 2, resource: this.noisyView },
                { binding: 3, resource: this.blurredView }
            ]
        });

        this.blurParamsBindGroup = this.device.createBindGroup({
            layout: this.blurPipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.blurredParamsBuffer } }]
        });
    }

    public updateParams(width: number, height: number, viewMatrix: Float32Array, invViewMatrix: Float32Array, projMatrix: Float32Array, invProjMatrix: Float32Array, frameCounter: number, zNear: number, zFar: number): void {
        this.ssgiParamsView.set({
            projectionMatrix: projMatrix,
            inverseProjectionMatrix: invProjMatrix,
            inverseViewMatrix: invViewMatrix,
            viewMatrix: viewMatrix,
            screenResolution: [width, height],
            rayStepSize: 0.1,
            maxSteps: 16,
            thickness: 0.5,
            frameCounter: frameCounter
        });
        this.device.queue.writeBuffer(this.ssgiParamsBuffer, 0, this.ssgiParamsView.arrayBuffer);

        this.blurredParamsView.set({
            normalSharpness: 256.0,
            depthSharpness: 64.0,
            blurRadius: 4.0,
            screenResolution: [width, height],
            zNear: zNear,
            zFar: zFar,
        });
        this.device.queue.writeBuffer(this.blurredParamsBuffer, 0, this.blurredParamsView.arrayBuffer);
    }

    public compute(commandEncoder: GPUCommandEncoder, width: number, height: number): void {
        const groupsX = Math.ceil(width / 8);
        const groupsY = Math.ceil(height / 8);

        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeSamplersBindGroup);
        computePass.setBindGroup(1, this.computeTexturesBindGroup);
        computePass.setBindGroup(2, this.computeParamsBindGroup);
        computePass.dispatchWorkgroups(groupsX, groupsY, 1);
        computePass.end();

        const blurPass = commandEncoder.beginComputePass();
        blurPass.setPipeline(this.blurPipeline);
        blurPass.setBindGroup(0, this.blurTexturesBindGroup);
        blurPass.setBindGroup(1, this.blurParamsBindGroup);
        blurPass.dispatchWorkgroups(groupsX, groupsY, 1);
        blurPass.end();
    }

    public getResultView(): GPUTextureView {
        return this.blurredView;
    }
}