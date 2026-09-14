import { makeShaderDataDefinitions, makeStructuredView, type StructuredView } from "webgpu-utils";
import { SSGIComputeShaderWGSL } from "../shaders/SSGIComputeShader.wgsl";
import { SSGISpatialBlurComputeShaderWGSL } from "../shaders/SSGISpatialBlurComputeShader.wgsl";
import { WebGPUTexture } from "../WebGPUTexture";

export class SSGIPass {
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

    private ssgiParamsBuffer!: GPUBuffer;
    private ssgiParamsView!: StructuredView;
    private blurredParamsBuffer!: GPUBuffer;
    private blurredParamsView!: StructuredView;

    private computeSamplersBindGroup!: GPUBindGroup;
    private computeTexturesBindGroup!: GPUBindGroup;
    private computeParamsBindGroup!: GPUBindGroup;
    private noiseBindGroup!: GPUBindGroup;
    
    private blurXTexturesBindGroupFirst!: GPUBindGroup;
    private blurXTexturesBindGroupNext!: GPUBindGroup;
    private blurYTexturesBindGroup!: GPUBindGroup;
    private blurXParamsBindGroup!: GPUBindGroup;
    private blurYParamsBindGroup!: GPUBindGroup;

    private noise!: WebGPUTexture;

    public config = {
        rayStepSize: 0.35,
        maxSteps: 10,
        thickness: 2.0,
        normalSharpness: 10.0, 
        depthSharpness: 2.0,  
        blurRadius: 3.0,    
        blurIterations: 3    
    };

    constructor(device: GPUDevice) {
        this.device = device;
    }

    public async init(){
        await this.initTextures();
        this.initPipelines();
        this.initBuffers();
    }

    private async initTextures(){
        this.noise = await WebGPUTexture.create(this.device, "./assets/LDR_RGB1_6.png");
    }

    private initPipelines(): void {
        this.computePipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: this.device.createShaderModule({ code: SSGIComputeShaderWGSL }), entryPoint: 'main' }
        });

        const blurModule = this.device.createShaderModule({ code: SSGISpatialBlurComputeShaderWGSL });

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
                stride: f32, 
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
        if (this.intermediateTexture) this.intermediateTexture.destroy();
        if (this.blurredTexture) this.blurredTexture.destroy();

        this.noisyTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.noisyView = this.noisyTexture.createView();

        this.intermediateTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.intermediateView = this.intermediateTexture.createView();

        this.blurredTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
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

        this.noiseBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(3),
            entries: [
                { binding: 0, resource: this.noise.view }
            ]
        });

        this.blurXTexturesBindGroupFirst = this.device.createBindGroup({
            layout: this.blurXPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: depthView },
                { binding: 1, resource: normalView },
                { binding: 2, resource: this.noisyView },
                { binding: 3, resource: this.intermediateView }
            ]
        });

        this.blurXTexturesBindGroupNext = this.device.createBindGroup({
            layout: this.blurXPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: depthView },
                { binding: 1, resource: normalView },
                { binding: 2, resource: this.blurredView },
                { binding: 3, resource: this.intermediateView }
            ]
        });

        this.blurYTexturesBindGroup = this.device.createBindGroup({
            layout: this.blurYPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: depthView },
                { binding: 1, resource: normalView },
                { binding: 2, resource: this.intermediateView },
                { binding: 3, resource: this.blurredView }
            ]
        });

        this.blurXParamsBindGroup = this.device.createBindGroup({
            layout: this.blurXPipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.blurredParamsBuffer } }]
        });

        this.blurYParamsBindGroup = this.device.createBindGroup({
            layout: this.blurYPipeline.getBindGroupLayout(1),
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
            rayStepSize: this.config.rayStepSize,
            maxSteps: this.config.maxSteps,
            thickness: this.config.thickness,
            frameCounter: frameCounter
        });
        this.device.queue.writeBuffer(this.ssgiParamsBuffer, 0, this.ssgiParamsView.arrayBuffer);

        this.blurredParamsView.set({
            normalSharpness: this.config.normalSharpness,
            depthSharpness: this.config.depthSharpness,
            blurRadius: this.config.blurRadius,
            stride: 1.0, 
            screenResolution: [width, height],
            zNear: zNear,
            zFar: zFar,
        });
        this.device.queue.writeBuffer(this.blurredParamsBuffer, 0, this.blurredParamsView.arrayBuffer);
    }

    public compute(commandEncoder: GPUCommandEncoder, width: number, height: number, timestampWrites?: any): void {
        const groupsX = Math.ceil(width / 8);
        const groupsY = Math.ceil(height / 8);

        const computePass = commandEncoder.beginComputePass({timestampWrites});
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeSamplersBindGroup);
        computePass.setBindGroup(1, this.computeTexturesBindGroup);
        computePass.setBindGroup(2, this.computeParamsBindGroup);
        computePass.setBindGroup(3, this.noiseBindGroup);
        computePass.dispatchWorkgroups(groupsX, groupsY, 1);
        computePass.end();

        if (this.config.blurIterations > 0) {
            for(let i = 0; i < this.config.blurIterations; i++) {
                const isFirstPass = (i === 0);
                
                this.blurredParamsView.set({ stride: Math.pow(2, i) });
                this.device.queue.writeBuffer(this.blurredParamsBuffer, 0, this.blurredParamsView.arrayBuffer);

                const blurPass = commandEncoder.beginComputePass();
                blurPass.setPipeline(this.blurXPipeline);
                blurPass.setBindGroup(0, isFirstPass ? this.blurXTexturesBindGroupFirst : this.blurXTexturesBindGroupNext);
                blurPass.setBindGroup(1, this.blurXParamsBindGroup);
                blurPass.dispatchWorkgroups(groupsX, groupsY, 1);

                blurPass.setPipeline(this.blurYPipeline);
                blurPass.setBindGroup(0, this.blurYTexturesBindGroup);
                blurPass.setBindGroup(1, this.blurYParamsBindGroup);
                blurPass.dispatchWorkgroups(groupsX, groupsY, 1);
                blurPass.end();
            }
        }
    }

    public getResultView(): GPUTextureView {
        return this.config.blurIterations > 0 ? this.blurredView : this.noisyView;
    }
}