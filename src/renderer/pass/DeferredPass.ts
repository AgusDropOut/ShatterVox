import { WebGPUPipelineFactory } from "../WebGPUPipelineFactory";
import { deferredShader } from "../shaders/DeferredShader.wgsl";
import { LightManager } from "../LightManager";
import { ClusteredShading } from "../ClusteredShading";
import { PhysicsFacade } from "../../physics/PhysicsFacade";
import { vec3 } from "gl-matrix";

export class DeferredPass {
    private device: GPUDevice;
    private pipeline!: GPURenderPipeline;

    private deferredTexture!: GPUTexture;
    private deferredView!: GPUTextureView;

    public lightManager!: LightManager;
    private clusteredShading!: ClusteredShading;

    private gBufferBindGroup!: GPUBindGroup;
    private cameraBindGroup!: GPUBindGroup;
    private clusteredShadingBindGroup!: GPUBindGroup;

    constructor(device: GPUDevice) {
        this.device = device;
        this.pipeline = WebGPUPipelineFactory.createPipeline(this.device, 'DEFERRED', deferredShader, "rgba16float", false, false);
        this.lightManager = new LightManager(this.device, this.pipeline.getBindGroupLayout(2));
    }

    public resize(
        width: number, 
        height: number, 
        albedoView: GPUTextureView, 
        normalView: GPUTextureView, 
        depthView: GPUTextureView, 
        gtaoView: GPUTextureView, 
        linearSampler: GPUSampler, 
        nearestSampler: GPUSampler, 
        viewBuffer: GPUBuffer, 
        cameraBufferPlus: GPUBuffer
    ): void {
        if (this.deferredTexture) this.deferredTexture.destroy();

        this.deferredTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.deferredView = this.deferredTexture.createView();

        this.gBufferBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: linearSampler },
                { binding: 1, resource: nearestSampler },
                { binding: 2, resource: albedoView },
                { binding: 3, resource: normalView },
                { binding: 4, resource: depthView },
                { binding: 5, resource: gtaoView }
            ]
        });

        this.cameraBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: cameraBufferPlus } }]
        });

        if (!this.clusteredShading) {
            this.clusteredShading = new ClusteredShading(this.device, this.lightManager, viewBuffer);
        }
        
        this.clusteredShading.updateParamsBuffer();
        this.clusteredShading.createClusters();

        this.clusteredShadingBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(3),
            entries: [
                { binding: 0, resource: { buffer: this.clusteredShading.getClusterBuffer() } },
                { binding: 1, resource: { buffer: this.clusteredShading.getParamsBuffer() } }
            ]
        });
    }

    public computeClusters(commandEncoder: GPUCommandEncoder): void {
        if (this.clusteredShading) {
            this.clusteredShading.assignLightsToClusters(commandEncoder);
        }
    }

    public updateCameraPosition(cameraPosition: vec3): void {
        if (this.clusteredShading) {
            this.clusteredShading.updateParamsBuffer(cameraPosition);
        }
    }

    public draw(commandEncoder: GPUCommandEncoder, physicsFacade: PhysicsFacade, timestampWrites?: any): void {
        this.lightManager.updateDynamicLights(physicsFacade);
        this.lightManager.updateLightBuffer();
        
        const deferredRenderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.deferredView,
                clearValue: { r: 0.0, g: 0.8, b: 0.8, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            timestampWrites
        });
        
        deferredRenderPass.setPipeline(this.pipeline);
        deferredRenderPass.setBindGroup(0, this.gBufferBindGroup);
        deferredRenderPass.setBindGroup(1, this.cameraBindGroup);
        deferredRenderPass.setBindGroup(2, this.lightManager.getBindGroup());
        deferredRenderPass.setBindGroup(3, this.clusteredShadingBindGroup);
        deferredRenderPass.draw(6, 1, 0, 0);
        deferredRenderPass.end();
    }

    public getResultView(): GPUTextureView {
        return this.deferredView;
    }
}