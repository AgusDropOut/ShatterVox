import { makeShaderDataDefinitions, makeStructuredView, type StructuredView } from "webgpu-utils";
import { TAAShaderWGSL } from "../shaders/TAAShader.wgsl"

export class TAAPass {
    private device: GPUDevice;
    private pipeline!: GPURenderPipeline;

    private historyTextureA!: GPUTexture;
    private historyTextureB!: GPUTexture;
    private historyViewA!: GPUTextureView;
    private historyViewB!: GPUTextureView;

    private motionVectorTexture!: GPUTexture;
    public motionVectorView!: GPUTextureView;

    private taaParamsBuffer!: GPUBuffer;
    private taaParamsView!: StructuredView;

    private bindGroupA!: GPUBindGroup;
    private bindGroupB!: GPUBindGroup;

    public config = {
        alpha: 0.09,
        vectorSearchRadius: 2,
        colorClampRadius: 2
    };

    constructor(device: GPUDevice, presentationFormat: GPUTextureFormat) {
        this.device = device;
       
        const shaderModule = this.device.createShaderModule({ code: TAAShaderWGSL });
        this.pipeline = this.device.createRenderPipeline({
            label: 'TAA Pipeline',
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: "vs_main"
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fs_main",
                targets: [
                    { format: presentationFormat }, 
                    { format: "rgba16float" }      
                ]
            },
            primitive: { topology: "triangle-list" }
        });

        this.initBuffers();
    }

    private initBuffers(): void {
        const defs = makeShaderDataDefinitions(`
            struct TAAParams {
                screenResolution: vec2<f32>,
                alpha: f32,
                vectorSearchRadius: f32,
                colorClampRadius: f32,
            };
        `);
        this.taaParamsView = makeStructuredView(defs.structs.TAAParams);
        this.taaParamsBuffer = this.device.createBuffer({
            size: this.taaParamsView.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    public resize(width: number, height: number, compositeView: GPUTextureView, linearSampler: GPUSampler): void {
        if (this.historyTextureA) this.historyTextureA.destroy();
        if (this.historyTextureB) this.historyTextureB.destroy();
        if (this.motionVectorTexture) this.motionVectorTexture.destroy();

        this.historyTextureA = this.device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.historyViewA = this.historyTextureA.createView();

        this.historyTextureB = this.device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.historyViewB = this.historyTextureB.createView();

        this.motionVectorTexture = this.device.createTexture({
            size: [width, height],
            format: "rg16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.motionVectorView = this.motionVectorTexture.createView();

        const createBindGroup = (historyReadView: GPUTextureView) => {
            return this.device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: linearSampler },
                    { binding: 1, resource: compositeView },
                    { binding: 2, resource: this.motionVectorView },
                    { binding: 3, resource: historyReadView },
                    { binding: 4, resource: { buffer: this.taaParamsBuffer } }
                ]
            });
        };

        this.bindGroupA = createBindGroup(this.historyViewB); 
        this.bindGroupB = createBindGroup(this.historyViewA);
    }

    public updateParams(width: number, height: number): void {
        this.taaParamsView.set({
            screenResolution: [width, height],
            alpha: this.config.alpha,
            vectorSearchRadius: this.config.vectorSearchRadius,
            colorClampRadius: this.config.colorClampRadius
        });
        this.device.queue.writeBuffer(this.taaParamsBuffer, 0, this.taaParamsView.arrayBuffer);
    }

    public draw(commandEncoder: GPUCommandEncoder, screenTextureView: GPUTextureView, frameCounter: number, timestampWrites?: any): void {
        const isEvenFrame = frameCounter % 2 === 0;

        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: screenTextureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: isEvenFrame ? this.historyViewA : this.historyViewB,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }
            ], 
            timestampWrites
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, isEvenFrame ? this.bindGroupA : this.bindGroupB);
        pass.draw(6, 1, 0, 0);
        pass.end();
    }
}