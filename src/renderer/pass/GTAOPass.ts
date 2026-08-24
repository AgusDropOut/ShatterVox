import { makeShaderDataDefinitions, makeStructuredView, type StructuredView } from "webgpu-utils";
import { InitialGTAOComputeShaderWGSL } from "../shaders/InitialGTAOComputeShader.wgsl";
import { GTAOBlurComputeShaderWGSL } from "../shaders/GTAOBlurComputeShader.wgsl";

export class GTAOPass {
    private device: GPUDevice;
    private computePipeline!: GPUComputePipeline;
    private blurXPipeline!: GPUComputePipeline;
    private blurYPipeline!: GPUComputePipeline;

    private noisyTexture!: GPUTexture;
    private intermediateTexture!: GPUTexture;
    private blurredTexture!: GPUTexture;
    
    public noisyView!: GPUTextureView;
    private intermediateView!: GPUTextureView;
    public blurredView!: GPUTextureView;

    private paramsBuffer!: GPUBuffer;
    private paramsView!: StructuredView;

    private computeBindGroup!: GPUBindGroup;
    private computeMatrixesBindGroup!: GPUBindGroup;
    
    private blurXBindGroup!: GPUBindGroup;
    private blurYBindGroup!: GPUBindGroup;
    private blurXParamsBindGroup!: GPUBindGroup;
    private blurYParamsBindGroup!: GPUBindGroup;

    public config = {
        radius: 0.55,
        falloff: 0.1,
        thickness: 0.01,
        blurRadius: 2.0,
        blurSharpness: 90.0,
        minRadiusPixels: 1.0,
        maxRadiusPixels: 50.0,
        numSlices: 2,
        maxSteps: 2,
        biasRadians: 0.05,
    };

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

        const blurModule = this.device.createShaderModule({ code: GTAOBlurComputeShaderWGSL });
        
        this.blurXPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: blurModule, entryPoint: 'mainX' }
        });

        this.blurYPipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: blurModule, entryPoint: 'mainY' }
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
                radius: f32,
                falloff: f32,
                thickness: f32,
                blurRadius: f32,
                blurSharpness: f32,
                minRadiusPixels: f32,
                maxRadiusPixels: f32,
                numSlices: u32,
                maxSteps: u32,
                biasRadians: f32,
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
        if (this.intermediateTexture) this.intermediateTexture.destroy();
        if (this.blurredTexture) this.blurredTexture.destroy();

        this.noisyTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.noisyView = this.noisyTexture.createView();

        this.intermediateTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.intermediateView = this.intermediateTexture.createView();

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

        this.blurXBindGroup = this.device.createBindGroup({
            layout: this.blurXPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: depthView },
                { binding: 1, resource: this.noisyView },
                { binding: 2, resource: this.intermediateView },
                { binding: 3, resource: normalView }
            ]
        });

        this.blurYBindGroup = this.device.createBindGroup({
            layout: this.blurYPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: depthView },
                { binding: 1, resource: this.intermediateView },
                { binding: 2, resource: this.blurredView },
                { binding: 3, resource: normalView }
            ]
        });

        this.blurXParamsBindGroup = this.device.createBindGroup({
            layout: this.blurXPipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.paramsBuffer } }]
        });

        this.blurYParamsBindGroup = this.device.createBindGroup({
            layout: this.blurYPipeline.getBindGroupLayout(1),
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
            radius: this.config.radius,
            falloff: this.config.falloff,
            thickness: this.config.thickness,
            blurRadius: this.config.blurRadius,
            blurSharpness: this.config.blurSharpness,
            minRadiusPixels: this.config.minRadiusPixels,
            maxRadiusPixels: this.config.maxRadiusPixels,
            numSlices: this.config.numSlices,
            maxSteps: this.config.maxSteps,
            biasRadians: this.config.biasRadians,
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
        
        blurPass.setPipeline(this.blurXPipeline);
        blurPass.setBindGroup(0, this.blurXBindGroup);
        blurPass.setBindGroup(1, this.blurXParamsBindGroup);
        blurPass.dispatchWorkgroups(groupsX, groupsY, 1);

        blurPass.setPipeline(this.blurYPipeline);
        blurPass.setBindGroup(0, this.blurYBindGroup);
        blurPass.setBindGroup(1, this.blurYParamsBindGroup);
        blurPass.dispatchWorkgroups(groupsX, groupsY, 1);
        
        blurPass.end();
    }

    public getResultView(): GPUTextureView {
        return this.blurredView;
    }
}