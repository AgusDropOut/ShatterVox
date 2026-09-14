import { makeShaderDataDefinitions, makeStructuredView, type StructuredView } from "webgpu-utils";
import { postProcessShaderWGSL } from "../shaders/PostProcessShader.wgsl";

export class PostProcessPass {
    private device: GPUDevice;
    private pipeline!: GPURenderPipeline;
    
    private paramsBuffer!: GPUBuffer;
    private paramsView!: StructuredView;
    
    private bindGroupWithTAA!: GPUBindGroup;
    private bindGroupWithoutTAA!: GPUBindGroup;

    public config = {
        exposure: 1.0850,
        gamma: 2.386,
        contrast: 1.0595,
        saturation: 1.23,
        toneMappingMethod: 1 
    };

    constructor(device: GPUDevice, presentationFormat: GPUTextureFormat) {
        this.device = device;
        
        const shaderModule = this.device.createShaderModule({ code: postProcessShaderWGSL });
        
        this.pipeline = this.device.createRenderPipeline({
            label: 'Post Process Pipeline',
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: "vs_main"
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fs_main",
                targets: [
                    { format: presentationFormat } 
                ]
            },
            primitive: { topology: "triangle-list" }
        });

        this.initBuffers();
    }

    private initBuffers(): void {
        const defs = makeShaderDataDefinitions(`
            struct PostProcessParams {
                exposure: f32,
                gamma: f32,
                contrast: f32,
                saturation: f32,
                toneMappingMethod: u32,
            };
        `);
        this.paramsView = makeStructuredView(defs.structs.PostProcessParams);
        this.paramsBuffer = this.device.createBuffer({
            size: this.paramsView.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    public resize(compositionView: GPUTextureView, taaView: GPUTextureView, linearSampler: GPUSampler): void {
        this.bindGroupWithTAA = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: linearSampler },
                { binding: 1, resource: taaView },
                { binding: 2, resource: { buffer: this.paramsBuffer } }
            ]
        });

        this.bindGroupWithoutTAA = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: linearSampler },
                { binding: 1, resource: compositionView },
                { binding: 2, resource: { buffer: this.paramsBuffer } }
            ]
        });
    }

    public updateParams(): void {
        this.paramsView.set({
            exposure: this.config.exposure,
            gamma: this.config.gamma,
            contrast: this.config.contrast,
            saturation: this.config.saturation,
            toneMappingMethod: this.config.toneMappingMethod
        });
        this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsView.arrayBuffer);
    }

    public draw(commandEncoder: GPUCommandEncoder, outputView: GPUTextureView, useTAA: boolean, timestampWrites?: any): void {
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: outputView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }
            ], 
            timestampWrites
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, useTAA ? this.bindGroupWithTAA : this.bindGroupWithoutTAA);
        pass.draw(6, 1, 0, 0);
        pass.end();
    }
}