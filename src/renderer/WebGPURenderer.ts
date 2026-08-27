import { World } from "../world/World";
import { EntityRepository } from "../entity/EntityRepository";
import { PhysicsFacade } from "../physics/PhysicsFacade";
import { WebGPUPipelineFactory } from "./WebGPUPipelineFactory";
import { WebGPUTexture } from "./WebGPUTexture";
import { physicsDebugShaderWGSL } from "./shaders/PhysicsDebugShader.wgsl";
import { mat4 } from "gl-matrix";
import { debugColorQuadShaderWGSL, debugDepthQuadShaderWGSL } from "./shaders/DebugQuadShader";
import { Engine } from "../core/Engine";

import { GeometryPass } from "./pass/GeometryPass";
import { DeferredPass } from "./pass/DeferredPass";
import { GTAOPass } from "./pass/GTAOPass";
import { SSGIPass } from "./pass/SSGIPass";
import { CompositionPass } from "./pass/CompositionPass";
import { TAAPass } from "./pass/TAAPass";
import { GPUTimer } from "./GPUTimer";

export class WebGPURenderer {
    public canvas: HTMLCanvasElement;
    public device!: GPUDevice;
    public context!: GPUCanvasContext;
    public presentationFormat!: GPUTextureFormat;

    private debugPipeline!: GPURenderPipeline;
    private debugColorPipeline: GPURenderPipeline | null = null;
    private debugDepthPipeline: GPURenderPipeline | null = null;

    private linearSampler: GPUSampler | null = null;
    private nearestSampler: GPUSampler | null = null;

    private depthTexture!: GPUTexture;
    private albedoTexture!: GPUTexture;
    private normalTexture!: GPUTexture;
    
    public depthView!: GPUTextureView;
    public albedoView!: GPUTextureView;
    public normalView!: GPUTextureView;

    private atlas!: WebGPUTexture;
    private viewBuffer!: GPUBuffer;
    private projectionBuffer!: GPUBuffer;
    private cameraBufferPlus!: GPUBuffer;

    private debugCameraBindGroup!: GPUBindGroup;
    private commandEncoder: GPUCommandEncoder | null = null;

    private debugPosBuffer: GPUBuffer | null = null;
    private debugColBuffer: GPUBuffer | null = null;
    private debugPosBufferSize: number = 0;
    private debugColBufferSize: number = 0;

    private geometryPass!: GeometryPass;
    private deferredPass!: DeferredPass;
    private gtaoPass!: GTAOPass;
    private ssgiPass!: SSGIPass;
    private compositionPass!: CompositionPass;
    private taaPass!: TAAPass;

    private timer!: GPUTimer;
    private isTimerSupported: boolean = false;

    public gpuTimings = {
        Geometry: '0.00',
        GTAO: '0.00',
        Deferred: '0.00',
        SSGI: '0.00',
        Composition: '0.00',
        TAA: '0.00',
        Total: '0.00'
    };

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    public async init(): Promise<boolean> {
        if (!navigator.gpu) return false;
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return false;
        
        const requiredFeatures: GPUFeatureName[] = [];
        this.isTimerSupported = adapter.features.has('timestamp-query');
        if (this.isTimerSupported) {
            requiredFeatures.push('timestamp-query');
        }

        this.device = await adapter.requestDevice({ requiredFeatures });

        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: 'opaque', 
        });

        this.atlas = await WebGPUTexture.create(this.device, "/assets/atlas.png");

        this.initDebugPipelines();

        this.geometryPass = new GeometryPass(this.device, this.presentationFormat);
        this.geometryPass.init(this.atlas);
        
        this.deferredPass = new DeferredPass(this.device);
        this.gtaoPass = new GTAOPass(this.device);
        this.ssgiPass = new SSGIPass(this.device);
        await this.ssgiPass.init();
        
        this.compositionPass = new CompositionPass(this.device, "rgba16float"); 
        this.taaPass = new TAAPass(this.device, this.presentationFormat);

        this.debugPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'DEBUG_LINES', physicsDebugShaderWGSL, this.presentationFormat, true);

        this.projectionBuffer = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.viewBuffer = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.cameraBufferPlus = this.device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

        this.debugCameraBindGroup = this.device.createBindGroup({ layout: this.debugPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.cameraBufferPlus } }] });

        if (this.isTimerSupported) {
            this.timer = new GPUTimer(this.device, ['Geometry', 'GTAO', 'Deferred', 'SSGI', 'Composition', 'TAA']);
        }

        this.resize(this.canvas.width, this.canvas.height);

        return true;
    }

    private initDebugPipelines(): void {
        if (this.debugColorPipeline) return;
        this.linearSampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        this.nearestSampler = this.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });

        const createPipeline = (shaderCode: string) => {
            const module = this.device.createShaderModule({ code: shaderCode });
            return this.device.createRenderPipeline({ layout: 'auto', vertex: { module, entryPoint: 'vs_main' }, fragment: { module, entryPoint: 'fs_main', targets: [{ format: this.presentationFormat }] }, primitive: { topology: 'triangle-list' } });
        };
        this.debugColorPipeline = createPipeline(debugColorQuadShaderWGSL);
        this.debugDepthPipeline = createPipeline(debugDepthQuadShaderWGSL);
    }

    public getModelLayout(): GPUBindGroupLayout {
        return this.geometryPass.getModelLayout();
    }

    public resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
        if (!this.device) return; 

        if (this.depthTexture) this.depthTexture.destroy();
        if (this.albedoTexture) this.albedoTexture.destroy();
        if (this.normalTexture) this.normalTexture.destroy();

        this.albedoTexture = this.device.createTexture({ size: [width, height], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
        this.albedoView = this.albedoTexture.createView();

        this.normalTexture = this.device.createTexture({ size: [width, height], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
        this.normalView = this.normalTexture.createView();

        this.depthTexture = this.device.createTexture({ size: [width, height], format: "depth32float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
        this.depthView = this.depthTexture.createView();

        if(!this.linearSampler || !this.nearestSampler) throw new Error("Samplers not initialized");

        this.gtaoPass.resize(width, height, this.depthView, this.normalView, this.nearestSampler);
        this.deferredPass.resize(width, height, this.albedoView, this.normalView, this.depthView, this.gtaoPass.getResultView(), this.linearSampler, this.nearestSampler, this.viewBuffer, this.cameraBufferPlus);
        this.ssgiPass.resize(width, height, this.depthView, this.normalView, this.deferredPass.getResultView(), this.linearSampler, this.nearestSampler);
        this.compositionPass.resize(width, height, this.deferredPass.getResultView(), this.albedoView, this.ssgiPass.getResultView(), this.linearSampler);
        this.taaPass.resize(width, height, this.compositionPass.getResultView(), this.linearSampler);
    }

    public beginFrame(viewProjMatrix: Float32Array, invViewProjMatrix: Float32Array, viewMatrix: Float32Array, frameCounter: number): void {
        this.geometryPass.updateCamera(viewMatrix as mat4, Engine.projectionMatrix, frameCounter);

        const combinedCameraData = new Float32Array(32);
        combinedCameraData.set(viewProjMatrix, 0);       
        combinedCameraData.set(invViewProjMatrix, 16);   
        
        this.device.queue.writeBuffer(this.viewBuffer, 0, viewMatrix);
        this.device.queue.writeBuffer(this.cameraBufferPlus, 0, combinedCameraData);
        this.device.queue.writeBuffer(this.projectionBuffer, 0, Engine.projectionMatrix as Float32Array);

        const invProjMatrix = mat4.create();
        mat4.invert(invProjMatrix, Engine.projectionMatrix);
        const invViewMatrix = mat4.create();
        mat4.invert(invViewMatrix, viewMatrix);

        this.gtaoPass.updateParams(this.canvas.width, this.canvas.height, viewMatrix, Engine.projectionMatrix as Float32Array, invProjMatrix as Float32Array, Engine.zNear, Engine.zFar);
        this.ssgiPass.updateParams(this.canvas.width, this.canvas.height, viewMatrix, invViewMatrix as Float32Array, Engine.projectionMatrix as Float32Array, invProjMatrix as Float32Array, frameCounter, Engine.zNear, Engine.zFar);
        this.taaPass.updateParams(this.canvas.width, this.canvas.height); 

        this.commandEncoder = this.device.createCommandEncoder();

        this.deferredPass.computeClusters(this.commandEncoder);
    }

    public drawGeometry(world: World, entityRepository: EntityRepository, physicsFacade: PhysicsFacade): void {
        if (!this.commandEncoder) return;
        this.geometryPass.draw(
            this.commandEncoder,
            this.albedoView,
            this.normalView,
            this.taaPass.motionVectorView,
            this.depthView,
            world,
            entityRepository,
            physicsFacade,
            this.isTimerSupported ? this.timer.getTimestampWrites('Geometry') : undefined
        );
    }

    public computeGTAO(): void {
        if (this.commandEncoder) {
            this.gtaoPass.compute(this.commandEncoder, this.canvas.width, this.canvas.height, this.isTimerSupported ? this.timer.getTimestampWrites('GTAO') : undefined);
        }
    }

    public drawDeferred(physicsFacade: PhysicsFacade): void {
        if (!this.commandEncoder) return;
        this.deferredPass.draw(this.commandEncoder, physicsFacade, this.isTimerSupported ? this.timer.getTimestampWrites('Deferred') : undefined);
    }

    public computeSSGI(): void {
        if (this.commandEncoder) {
            this.ssgiPass.compute(this.commandEncoder, this.canvas.width, this.canvas.height, this.isTimerSupported ? this.timer.getTimestampWrites('SSGI') : undefined);
        }
    }

    public drawComposition(): void {
        if (!this.commandEncoder) return;
        this.compositionPass.draw(this.commandEncoder, this.isTimerSupported ? this.timer.getTimestampWrites('Composition') : undefined);
    }

    public drawTAA(frameCounter: number): void {
        if (!this.commandEncoder) return;
        const screenTextureView = this.context.getCurrentTexture().createView();
        this.taaPass.draw(this.commandEncoder, screenTextureView, frameCounter, this.isTimerSupported ? this.timer.getTimestampWrites('TAA') : undefined);
    }

    public drawPhysicsDebug(vertices: Float32Array | null, colors: Float32Array | null): void {
        if (!this.commandEncoder || !vertices || !colors || vertices.length === 0) return;

        if (!this.debugPosBuffer || this.debugPosBufferSize < vertices.byteLength) {
            if (this.debugPosBuffer) this.debugPosBuffer.destroy();
            this.debugPosBufferSize = vertices.byteLength + 1024;
            this.debugPosBuffer = this.device.createBuffer({ size: this.debugPosBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        }

        if (!this.debugColBuffer || this.debugColBufferSize < colors.byteLength) {
            if (this.debugColBuffer) this.debugColBuffer.destroy();
            this.debugColBufferSize = colors.byteLength + 1024;
            this.debugColBuffer = this.device.createBuffer({ size: this.debugColBufferSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        }

        this.device.queue.writeBuffer(this.debugPosBuffer, 0, vertices);
        this.device.queue.writeBuffer(this.debugColBuffer, 0, colors);

        const pass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'load',
                storeOp: 'store',
            }]
        });

        pass.setPipeline(this.debugPipeline);
        pass.setBindGroup(0, this.debugCameraBindGroup);
        pass.setVertexBuffer(0, this.debugPosBuffer);
        pass.setVertexBuffer(1, this.debugColBuffer);
        pass.draw(vertices.length / 3);
        pass.end();
    }

    public endFrame(): void {
        if (this.commandEncoder) {
            if (this.isTimerSupported) {
                this.timer.resolve(this.commandEncoder);
            }
            this.device.queue.submit([this.commandEncoder.finish()]);
        }
        this.commandEncoder = null;

        if (this.isTimerSupported) {
            this.timer.readResults().then(results => {
                if (results) {
                    let total = 0;
                    for (const [key, value] of results.entries()) {
                        if (key in this.gpuTimings) {
                            this.gpuTimings[key as keyof typeof this.gpuTimings] = value.toFixed(2);
                            total += value;
                        }
                    }
                    this.gpuTimings.Total = total.toFixed(2);
                }
            });
        }
    }

    public async loadEntityAsset(id: string, objUrl: string, textureUrl: string): Promise<void> {
        await this.geometryPass.loadEntityAsset(id, objUrl, textureUrl);
    }

    public debugDrawTexture(textureView: GPUTextureView, isDepth: boolean = false): void {
        if (!this.commandEncoder) return;
        this.initDebugPipelines();

        const pipeline = isDepth ? this.debugDepthPipeline! : this.debugColorPipeline!;
        const sampler = isDepth ? this.nearestSampler! : this.linearSampler!;

        const bindGroup = this.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: sampler }, { binding: 1, resource: textureView }]
        });

        const screenTextureView = this.context.getCurrentTexture().createView();
        const debugPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{ view: screenTextureView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' }]
        });

        debugPass.setPipeline(pipeline);
        debugPass.setBindGroup(0, bindGroup);
        debugPass.draw(6, 1, 0, 0); 
        debugPass.end();
    }
    
    public get deferredView() { return this.deferredPass.getResultView(); }
    public get noisyGTAOView() { return this.gtaoPass.noisyView; }
    public get blurredGTAOView() { return this.gtaoPass.blurredView; }
    public get noisySSGIView() { return this.ssgiPass.noisyView; }
    public get blurredSSGIView() { return this.ssgiPass.blurredView; }

    public get ssgiConfig(){return this.ssgiPass.config}
    public get gtaoConfig(){return this.gtaoPass.config}
}