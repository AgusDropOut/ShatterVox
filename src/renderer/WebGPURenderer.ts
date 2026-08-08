import { World } from "../world/World";
import { EntityRepository } from "../entity/EntityRepository";
import { PhysicsFacade } from "../physics/PhysicsFacade";
import { AssetManager } from "../renderer/AssetManager";
import { WebGPUUniformBuffer } from "../renderer/WebGPUUniformBuffer";
import { chunkShaderWGSL } from "./shaders/ChunkShader.wgsl";
import { WebGPUPipelineFactory } from "./WebGPUPipelineFactory";
import { WebGPUTexture } from "./WebGPUTexture";
import { entityShaderWGSL } from "./shaders/EntityShader.wgsl";
import { physicsDebugShaderWGSL } from "./shaders/PhysicsDebugShader.wgsl";
import { Debri } from "../world/Debri";
import { DebriBatchManager } from "./DebriBatchManager";
import { SmallDebriBatchManager } from "./SmallDebriBatchManager";
import { mat4 } from "gl-matrix";
import { debriShaderWGSL } from "./shaders/DebriShader.wgsl";
import { globalEventBus } from "../core/EventBus";
import { debugColorQuadShaderWGSL, debugDepthQuadShaderWGSL } from "./shaders/DebugQuadShader";
import { deferredShader } from "./shaders/DeferredShader.wgsl";
import { LightManager } from "./LightManager";
import { smallDebriShaderWGSL } from "./shaders/SmallDebriShader.wgsl";
import { ClusteredShading } from "./ClusteredShading";


export class WebGPURenderer {
    public canvas: HTMLCanvasElement;
    public device!: GPUDevice;
    public context!: GPUCanvasContext;
    public presentationFormat!: GPUTextureFormat;

    private chunkPipeline!: GPURenderPipeline;
    public entityPipeline!: GPURenderPipeline;
    private debriPipeline!: GPURenderPipeline;
    private smallDebriPipeline!: GPURenderPipeline;
    private debugPipeline!: GPURenderPipeline;
    private deferredPipeline!: GPURenderPipeline;

    private debugColorPipeline: GPURenderPipeline | null = null;
    private debugDepthPipeline: GPURenderPipeline | null = null;
    private linearSampler: GPUSampler | null = null;
    private nearestSampler: GPUSampler | null = null;

    private depthTexture!: GPUTexture;
    private albedoTexture!: GPUTexture;
    private normalTexture!: GPUTexture
    public depthView!: GPUTextureView;
    public albedoView!: GPUTextureView;
    public normalView!: GPUTextureView;

    private atlas!: WebGPUTexture;
    private cameraBuffer!: GPUBuffer;
    private cameraBufferPlus!: GPUBuffer;
    private cameraBindGroup!: GPUBindGroup;
    public entityCameraBindGroup!: GPUBindGroup;
    private debriCameraBindGroup!: GPUBindGroup;
    private smallDebriCameraBindGroup!: GPUBindGroup;
    private debugCameraBindGroup!: GPUBindGroup;
    private deferredCameraBindGroup!: GPUBindGroup;
    private gBufferBindGroup!: GPUBindGroup;

    private commandEncoder: GPUCommandEncoder | null = null;
    private renderPass: GPURenderPassEncoder | null = null;
    private deferredRenderPass: GPURenderPassEncoder | null = null;

    private entityBuffers: Map<number, { buffer: WebGPUUniformBuffer, bindGroup: GPUBindGroup }> = new Map();
    private debriBatchManager!: DebriBatchManager;
    private smallDebriBatchManager!: SmallDebriBatchManager;
    private clusteredShading!: ClusteredShading;
    private lightManager!: LightManager;

    private debugPosBuffer: GPUBuffer | null = null;
    private debugColBuffer: GPUBuffer | null = null;
    private debugPosBufferSize: number = 0;
    private debugColBufferSize: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    public async init(): Promise<boolean> {
        if (!navigator.gpu) return false;

        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) return false;

        this.device = await adapter.requestDevice();
        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: 'opaque', 
        });

        this.atlas = await WebGPUTexture.create(this.device, "/assets/atlas.png");

        

        this.initDebugPipelines();

        this.chunkPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'CHUNK', chunkShaderWGSL, this.presentationFormat, true);
        this.entityPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'ENTITY', entityShaderWGSL, this.presentationFormat, true);
        this.debriPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'DEBRI', debriShaderWGSL, this.presentationFormat, true);
        this.smallDebriPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'SMALL_DEBRI', smallDebriShaderWGSL, this.presentationFormat, true);
        this.debugPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'DEBUG_LINES', physicsDebugShaderWGSL, this.presentationFormat, true);
        this.deferredPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'DEFERRED', deferredShader, this.presentationFormat, false, false);

        this.smallDebriBatchManager = new SmallDebriBatchManager(this.device, this.smallDebriPipeline.getBindGroupLayout(1));
        this.debriBatchManager = new DebriBatchManager(this.device, this.debriPipeline.getBindGroupLayout(1));
        this.lightManager = new LightManager(this.device, this.deferredPipeline.getBindGroupLayout(2));

        this.resize(this.canvas.width, this.canvas.height);

        

        this.cameraBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.cameraBufferPlus = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.cameraBindGroup = this.device.createBindGroup({
            layout: this.chunkPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.cameraBuffer } },
                { binding: 1, resource: this.atlas.sampler },
                { binding: 2, resource: this.atlas.view }
            ]
        });

        this.debriCameraBindGroup = this.device.createBindGroup({
            layout: this.debriPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.cameraBuffer } },
                { binding: 1, resource: this.atlas.sampler },
                { binding: 2, resource: this.atlas.view }
            ]
        });

        this.smallDebriCameraBindGroup = this.device.createBindGroup({
            layout: this.smallDebriPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.cameraBuffer } },
                { binding: 1, resource: this.atlas.sampler },
                { binding: 2, resource: this.atlas.view }
            ]
        });


        this.entityCameraBindGroup = this.device.createBindGroup({
            layout: this.entityPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.cameraBuffer } }
            ]
        });

        
        this.debugCameraBindGroup = this.device.createBindGroup({
            layout: this.debugPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.cameraBuffer } }
            ]
        });

        this.deferredCameraBindGroup = this.device.createBindGroup({
            layout: this.deferredPipeline.getBindGroupLayout(1),
            entries: [
                { binding: 0, resource: { buffer: this.cameraBufferPlus } }
            ]
        });


        if (!this.linearSampler) {
            throw new Error("Linear sampler not initialized");
        }
        if (!this.nearestSampler) {
            throw new Error("Nearest sampler not initialized");
        }

        this.gBufferBindGroup = this.device.createBindGroup({
            layout: this.deferredPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.linearSampler },
                { binding: 1, resource: this.nearestSampler },
                { binding: 2, resource: this.albedoView },
                { binding: 3, resource: this.normalView },
                { binding: 4, resource: this.depthView }
            ]
        });

        this.clusteredShading = new ClusteredShading(this.device);
        this.clusteredShading.createClusters();

            

        return true;
    }

    private initDebugPipelines(): void {
        if (this.debugColorPipeline) return;

        this.linearSampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        this.nearestSampler = this.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });

        const createPipeline = (shaderCode: string) => {
            const module = this.device.createShaderModule({ code: shaderCode });
            return this.device.createRenderPipeline({
                layout: 'auto',
                vertex: { module, entryPoint: 'vs_main' },
                fragment: { 
                    module, 
                    entryPoint: 'fs_main', 
                    targets: [{ format: this.presentationFormat }] 
                },
                primitive: { topology: 'triangle-list' }
            });
        };

        this.debugColorPipeline = createPipeline(debugColorQuadShaderWGSL);
        this.debugDepthPipeline = createPipeline(debugDepthQuadShaderWGSL);
    }

    public getModelLayout(): GPUBindGroupLayout {
        return this.chunkPipeline.getBindGroupLayout(1);
    }

    public resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
        if (!this.device) return; 
        this.resizeGBuffers(width, height);
    }

    private resizeGBuffers(width: number, height: number): void {
        
        if (this.depthTexture) this.depthTexture.destroy();
        if (this.albedoTexture) this.albedoTexture.destroy();
        if (this.normalTexture) this.normalTexture.destroy();

       
        this.albedoTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba8unorm",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.albedoView = this.albedoTexture.createView();

        this.normalTexture = this.device.createTexture({
            size: [width, height],
            format: "rgba16float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.normalView = this.normalTexture.createView();

        this.depthTexture = this.device.createTexture({
            size: [width, height],
            format: "depth32float", 
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.depthView = this.depthTexture.createView();
        if(!this.linearSampler || !this.nearestSampler) {
            throw new Error("Samplers not initialized");
        }
        this.gBufferBindGroup = this.device.createBindGroup({
            layout: this.deferredPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.linearSampler },
                { binding: 1, resource: this.nearestSampler },
                { binding: 2, resource: this.albedoView },
                { binding: 3, resource: this.normalView },
                { binding: 4, resource: this.depthView }
            ]
        });
        
    }

    public beginFrame(viewProjMatrix: Float32Array, invViewProjMatrix: Float32Array): GPURenderPassEncoder {
        const combinedCameraData = new Float32Array(32);
        combinedCameraData.set(viewProjMatrix, 0);       
        combinedCameraData.set(invViewProjMatrix, 16);   
        this.device.queue.writeBuffer(this.cameraBuffer, 0, viewProjMatrix);
        this.device.queue.writeBuffer(this.cameraBufferPlus, 0, combinedCameraData);

        this.commandEncoder = this.device.createCommandEncoder();

        this.renderPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.albedoView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.normalView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }
            ],
            depthStencilAttachment: {
                view: this.depthView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        return this.renderPass;
    }

    public drawWorld(world: World): void {
        if (!this.renderPass) return;

    
        this.renderPass.setPipeline(this.chunkPipeline);
        this.renderPass.setBindGroup(0, this.cameraBindGroup);

        for (const chunk of world.chunks.values()) {
            chunk.draw(this.renderPass);
        }

     
        for (let i = world.debri.length - 1; i >= 0; i--) {
            const debri = world.debri[i];
            debri.lifeTime += 16.67;
            if (debri.lifeTime > Debri.MAX_LIFETIME) {
                world.removeDebri(debri);
                globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: debri.id});
                debri.deleteGraphics();
            }
        }

        if (world.debri.length === 0) return;

       
        this.renderPass.setPipeline(this.debriPipeline);
        this.renderPass.setBindGroup(0, this.debriCameraBindGroup);
        
        this.debriBatchManager.updateAndUploadModelMatrixes(world.debri);
        this.renderPass.setBindGroup(1, this.debriBatchManager.getBindGroup());

        for (let i = 0; i < world.debri.length; i++) {
            const debri = world.debri[i];
            if(!debri.isSingleBlockMesh()) {
                debri.draw(this.renderPass, i); 
            }
        }

        this.renderPass.setPipeline(this.smallDebriPipeline);
        this.renderPass.setBindGroup(0, this.smallDebriCameraBindGroup);
        const count = this.smallDebriBatchManager.updateAndUploadModelMatrixesandUvs(world.debri);
        this.renderPass.setBindGroup(1, this.smallDebriBatchManager.getBindGroup());
        // Draw small debris
        this.renderPass.setVertexBuffer(0, this.smallDebriBatchManager.getVertexBuffer().buffer);
        this.renderPass.setVertexBuffer(1, this.smallDebriBatchManager.getNormalBuffer().buffer);
        this.renderPass.draw(36, count, 0, 0);

    }

    public drawEntities(entityRepository: EntityRepository, physicsFacade: PhysicsFacade): void {
        if (!this.renderPass) return;

        this.renderPass.setPipeline(this.entityPipeline);
        this.renderPass.setBindGroup(0, this.entityCameraBindGroup);

        for (const [entityId, renderComp] of entityRepository.renders.entries()) {
            const physComp = entityRepository.physics.get(entityId);
            if (!physComp) {
                this.entityBuffers.delete(entityId);
                continue;
            }

            const transform = physicsFacade.transforms.get(physComp.bodyId);
            if (!transform) continue;

            const asset = AssetManager.getAsset(renderComp.modelId);
            if (!asset || !asset.mesh || asset.mesh.vertexCount === 0 || !asset.materialBindGroup) {
                continue;
            }

            const modelMatrix = mat4.create();
            mat4.translate(modelMatrix, modelMatrix, transform.position);
            
            const rotationMat = mat4.create();
            mat4.fromQuat(rotationMat, transform.rotation);
            mat4.multiply(modelMatrix, modelMatrix, rotationMat);
            
            mat4.translate(modelMatrix, modelMatrix, [0, -0.125, 0]);
            mat4.scale(modelMatrix, modelMatrix, renderComp.scale);

            let instanceData = this.entityBuffers.get(entityId);
            if (!instanceData) {
                const buffer = new WebGPUUniformBuffer(this.device, modelMatrix as Float32Array);
                const bindGroup = this.device.createBindGroup({
                    layout: this.entityPipeline.getBindGroupLayout(2),
                    entries: [{ binding: 0, resource: { buffer: buffer.buffer } }]
                });
                instanceData = { buffer, bindGroup };
                this.entityBuffers.set(entityId, instanceData);
            } else {
                instanceData.buffer.update(modelMatrix as Float32Array);
            }

            this.renderPass.setBindGroup(1, asset.materialBindGroup);
            this.renderPass.setBindGroup(2, instanceData.bindGroup);

            asset.mesh.draw(this.renderPass);
        }
    }

    public drawPhysicsDebug(vertices: Float32Array | null, colors: Float32Array | null): void {
        if (!this.renderPass || !vertices || !colors || vertices.length === 0) return;

        if (!this.debugPosBuffer || this.debugPosBufferSize < vertices.byteLength) {
            if (this.debugPosBuffer) this.debugPosBuffer.destroy();
            this.debugPosBufferSize = vertices.byteLength + 1024;
            this.debugPosBuffer = this.device.createBuffer({
                size: this.debugPosBufferSize,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }

        if (!this.debugColBuffer || this.debugColBufferSize < colors.byteLength) {
            if (this.debugColBuffer) this.debugColBuffer.destroy();
            this.debugColBufferSize = colors.byteLength + 1024;
            this.debugColBuffer = this.device.createBuffer({
                size: this.debugColBufferSize,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }

        this.device.queue.writeBuffer(this.debugPosBuffer, 0, vertices);
        this.device.queue.writeBuffer(this.debugColBuffer, 0, colors);

        this.renderPass.setPipeline(this.debugPipeline);
        this.renderPass.setBindGroup(0, this.debugCameraBindGroup);
        this.renderPass.setVertexBuffer(0, this.debugPosBuffer);
        this.renderPass.setVertexBuffer(1, this.debugColBuffer);
       

        this.renderPass.draw(vertices.length / 3);
    }

    public drawDeferred(physicsFacade: PhysicsFacade): void {
        if (this.renderPass) {
            this.renderPass.end();
            this.renderPass = null;
        }
        if (!this.commandEncoder) return;
        this.lightManager.updateDynamicLights(physicsFacade);
        this.lightManager.updateLightBuffer();
        this.deferredRenderPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.8, b: 0.8, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });
        this.deferredRenderPass.setPipeline(this.deferredPipeline);
        this.deferredRenderPass.setBindGroup(0, this.gBufferBindGroup);
        this.deferredRenderPass.setBindGroup(1, this.deferredCameraBindGroup);
        this.deferredRenderPass.setBindGroup(2, this.lightManager.getBindGroup());
        this.deferredRenderPass.draw(6, 1, 0, 0);
        this.deferredRenderPass.end();
        this.deferredRenderPass = null;
    
    }

    public endFrame(): void {
        if (this.renderPass) this.renderPass.end();
        if (this.commandEncoder) {
            this.device.queue.submit([this.commandEncoder.finish()]);
        }
        
        this.renderPass = null;
        this.commandEncoder = null;

       
    }

    public async loadEntityAsset(id: string, objUrl: string, textureUrl: string): Promise<void> {
        const materialLayout = this.entityPipeline.getBindGroupLayout(1);
        await AssetManager.loadAsset(id, objUrl, textureUrl, this.device, materialLayout);
    }


    public debugDrawTexture(textureView: GPUTextureView, isDepth: boolean = false): void {
        if (this.renderPass) {
            this.renderPass.end();
            this.renderPass = null;
        }

        if (!this.commandEncoder) return;

        this.initDebugPipelines();

        const pipeline = isDepth ? this.debugDepthPipeline! : this.debugColorPipeline!;
        const sampler = isDepth ? this.nearestSampler! : this.linearSampler!;

        const bindGroup = this.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: textureView }
            ]
        });

        const screenTextureView = this.context.getCurrentTexture().createView();
        const debugPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: screenTextureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });

        debugPass.setPipeline(pipeline);
        debugPass.setBindGroup(0, bindGroup);
        debugPass.draw(6, 1, 0, 0); 
        debugPass.end();
    }
}