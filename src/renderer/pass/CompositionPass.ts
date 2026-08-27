import { WebGPUPipelineFactory } from "../WebGPUPipelineFactory";
import { compositionShaderWGSL } from "../shaders/CompositionShader.wgsl";

export class CompositionPass {
    private device: GPUDevice;
    private pipeline!: GPURenderPipeline;
    private bindGroup!: GPUBindGroup;
    
    private compositeTexture!: GPUTexture;
    private compositeView!: GPUTextureView;

    constructor(device: GPUDevice, format: GPUTextureFormat | string) {
        this.device = device;
        this.pipeline = WebGPUPipelineFactory.createPipeline(this.device, 'COMPOSITION', compositionShaderWGSL, format as GPUTextureFormat, false, false);
    }

    public resize(width: number, height: number, deferredView: GPUTextureView, albedoView: GPUTextureView, blurredSSGIView: GPUTextureView, linearSampler: GPUSampler): void {
        if (this.compositeTexture) {
            this.compositeTexture.destroy();
        }

        this.compositeTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        
        this.compositeView = this.compositeTexture.createView();

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: linearSampler },
                { binding: 1, resource: deferredView },
                { binding: 2, resource: albedoView },
                { binding: 3, resource: blurredSSGIView }
            ]
        });
    }

    public draw(commandEncoder: GPUCommandEncoder, timestampWrites?: any): void {
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.compositeView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            timestampWrites
        });
        
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(6, 1, 0, 0);
        pass.end();
    }

    public getResultView(): GPUTextureView {
        return this.compositeView;
    }
}