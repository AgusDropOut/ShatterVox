import { WebGPUPipelineFactory } from "../WebGPUPipelineFactory";
import { compositionShaderWGSL } from "../shaders/CompositionShader.wgsl";

export class CompositionPass {
    private device: GPUDevice;
    private pipeline!: GPURenderPipeline;
    private bindGroup!: GPUBindGroup;

    constructor(device: GPUDevice, presentationFormat: GPUTextureFormat) {
        this.device = device;
        this.pipeline = WebGPUPipelineFactory.createPipeline(this.device, 'COMPOSITION', compositionShaderWGSL, presentationFormat, false, false);
    }

    public resize(deferredView: GPUTextureView, albedoView: GPUTextureView, blurredSSGIView: GPUTextureView, linearSampler: GPUSampler): void {
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

    public draw(commandEncoder: GPUCommandEncoder, screenTextureView: GPUTextureView): void {
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: screenTextureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(6, 1, 0, 0);
        pass.end();
    }
}