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
import { mat4 } from "gl-matrix";

export class WebGPURenderer {
    public canvas: HTMLCanvasElement;
    public device!: GPUDevice;
    public context!: GPUCanvasContext;
    public presentationFormat!: GPUTextureFormat;

    private chunkPipeline!: GPURenderPipeline;
    public entityPipeline!: GPURenderPipeline;
    private debugPipeline!: GPURenderPipeline;

    private depthTexture!: GPUTexture;
    private depthView!: GPUTextureView;

    private atlas!: WebGPUTexture;
    private cameraBuffer!: GPUBuffer;
    private cameraBindGroup!: GPUBindGroup;
    public entityCameraBindGroup!: GPUBindGroup;
    private debugCameraBindGroup!: GPUBindGroup;

    private commandEncoder: GPUCommandEncoder | null = null;
    private renderPass: GPURenderPassEncoder | null = null;

    private entityBuffers: Map<number, { buffer: WebGPUUniformBuffer, bindGroup: GPUBindGroup }> = new Map();

    private debugPosBuffer: GPUBuffer | null = null;
    private debugColBuffer: GPUBuffer | null = null;
    private debugPosBufferSize: number = 0;
    private debugColBufferSize: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    public async init(): Promise<boolean> {
        if (!navigator.gpu) {
            console.error("WebGPU not supported on this browser.");
            return false;
        }

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

        this.resize(this.canvas.width, this.canvas.height);

        this.chunkPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'CHUNK', chunkShaderWGSL, this.presentationFormat);
        this.entityPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'ENTITY', entityShaderWGSL, this.presentationFormat);
        this.debugPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'DEBUG_LINES', physicsDebugShaderWGSL, this.presentationFormat);

        this.atlas = await WebGPUTexture.create(this.device, "/assets/atlas.png");

        this.cameraBuffer = this.device.createBuffer({
            size: 64,
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

        console.log("WebGPU initialized", adapter.info);
        return true;
    }

    public getModelLayout(): GPUBindGroupLayout {
        return this.chunkPipeline.getBindGroupLayout(1);
    }

    public resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;

        if (!this.device) return; 

        if (this.depthTexture) this.depthTexture.destroy();

        this.depthTexture = this.device.createTexture({
            size: [width, height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        
        this.depthView = this.depthTexture.createView();
    }

    public beginFrame(viewProjMatrix: Float32Array): GPURenderPassEncoder {
        this.device.queue.writeBuffer(this.cameraBuffer, 0, viewProjMatrix);

        this.commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        this.renderPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.4, b: 1.0, a: 1.0 }, 
                loadOp: 'clear',
                storeOp: 'store',
            }],
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

        for (const debri of world.debri) {
            debri.lifeTime += 16.67;
            if (debri.lifeTime > Debri.MAX_LIFETIME) {
                world.removeDebri(debri);
                debri.deleteGraphics();
                continue;
            }
            debri.draw(this.renderPass);
        }
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
}