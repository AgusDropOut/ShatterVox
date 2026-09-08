import { mat4 } from "gl-matrix";
import { AssetManager } from "../AssetManager";
import { WebGPUUniformBuffer } from "../WebGPUUniformBuffer";
import { WebGPUPipelineFactory } from "../WebGPUPipelineFactory";
import { WebGPUTexture } from "../WebGPUTexture";
import { DebriBatchManager } from "../DebriBatchManager";
import { SmallDebriBatchManager } from "../SmallDebriBatchManager";
import { chunkShaderWGSL } from "../shaders/ChunkShader.wgsl";
import { entityShaderWGSL } from "../shaders/EntityShader.wgsl";
import { debriShaderWGSL } from "../shaders/DebriShader.wgsl";
import { smallDebriShaderWGSL } from "../shaders/SmallDebriShader.wgsl";
import { World } from "../../world/World";
import { Debri } from "../../world/Debri";
import { EntityRepository } from "../../entity/EntityRepository";
import { PhysicsFacade } from "../../physics/PhysicsFacade";
import { globalEventBus } from "../../core/EventBus";
import { Engine } from "../../core/Engine"
import { FrustumCull } from "../FrustumCull";
import type { vec3, quat } from "gl-matrix";

export class GeometryPass {
    private device: GPUDevice;
    private presentationFormat: GPUTextureFormat;

    public chunkPipeline!: GPURenderPipeline;
    public entityPipeline!: GPURenderPipeline;
    private debriPipeline!: GPURenderPipeline;
    private smallDebriPipeline!: GPURenderPipeline;

    private viewProjBuffer!: GPUBuffer;
    private cameraData = new Float32Array(32);

    public cameraBindGroup!: GPUBindGroup;
    public entityCameraBindGroup!: GPUBindGroup;
    private debriCameraBindGroup!: GPUBindGroup;
    private smallDebriCameraBindGroup!: GPUBindGroup;

    private chunkNormalMappingBindGroup!: GPUBindGroup;
    private debriNormalMappingBindGroup!: GPUBindGroup;
    private smallDebriNormalMappingBindGroup!: GPUBindGroup;

    private entityBuffers: Map<number, { buffer: WebGPUUniformBuffer, bindGroup: GPUBindGroup, lastMatrix: Float32Array, isHighlighted: number }> = new Map();
    private debriBatchManager!: DebriBatchManager;
    private smallDebriBatchManager!: SmallDebriBatchManager;

    private frustumCulling!: FrustumCull;
    public currentHighlightedEntity: number | null = null;

    constructor(device: GPUDevice, presentationFormat: GPUTextureFormat) {
        this.device = device;
        this.presentationFormat = presentationFormat;
    }

    public init(atlas: WebGPUTexture, normalAtlas: WebGPUTexture): void {
        this.chunkPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'CHUNK', chunkShaderWGSL, this.presentationFormat, true);
        this.entityPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'ENTITY', entityShaderWGSL, this.presentationFormat, true);
        this.debriPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'DEBRI', debriShaderWGSL, this.presentationFormat, true);
        this.smallDebriPipeline = WebGPUPipelineFactory.createPipeline(this.device, 'SMALL_DEBRI', smallDebriShaderWGSL, this.presentationFormat, true);

        this.smallDebriBatchManager = new SmallDebriBatchManager(this.device, this.smallDebriPipeline.getBindGroupLayout(1));
        this.debriBatchManager = new DebriBatchManager(this.device, this.debriPipeline.getBindGroupLayout(1));

        this.frustumCulling = new FrustumCull();

        this.viewProjBuffer = this.device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

        this.cameraBindGroup = this.device.createBindGroup({ layout: this.chunkPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.viewProjBuffer } }, { binding: 1, resource: atlas.sampler }, { binding: 2, resource: atlas.view }] });
        this.debriCameraBindGroup = this.device.createBindGroup({ layout: this.debriPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.viewProjBuffer } }, { binding: 1, resource: atlas.sampler }, { binding: 2, resource: atlas.view }] });
        this.smallDebriCameraBindGroup = this.device.createBindGroup({ layout: this.smallDebriPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.viewProjBuffer } }, { binding: 1, resource: atlas.sampler }, { binding: 2, resource: atlas.view }] });
        this.entityCameraBindGroup = this.device.createBindGroup({ layout: this.entityPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.viewProjBuffer } }] });

        this.chunkNormalMappingBindGroup = this.device.createBindGroup({ layout: this.chunkPipeline.getBindGroupLayout(3), entries: [{ binding: 0, resource: normalAtlas.sampler }, { binding: 1, resource: normalAtlas.view }] });
        this.debriNormalMappingBindGroup = this.device.createBindGroup({ layout: this.debriPipeline.getBindGroupLayout(3), entries: [{ binding: 0, resource: normalAtlas.sampler }, { binding: 1, resource: normalAtlas.view }] });
        this.smallDebriNormalMappingBindGroup = this.device.createBindGroup({ layout: this.smallDebriPipeline.getBindGroupLayout(3), entries: [{ binding: 0, resource: normalAtlas.sampler }, { binding: 1, resource: normalAtlas.view }] });
    }

    public getModelLayout(): GPUBindGroupLayout {
        return this.chunkPipeline.getBindGroupLayout(1);
    }

    public async loadEntityAsset(id: string, objUrl: string, textureUrl: string): Promise<void> {
        const materialLayout = this.entityPipeline.getBindGroupLayout(1);
        await AssetManager.loadAsset(id, objUrl, textureUrl, this.device, materialLayout);
    }

    public updateCamera(viewMatrix: mat4, projectionMatrix: mat4, frameCounter: number): void {
        let jaltonX = (this.halton(frameCounter, 2) - 0.5) / Engine.screenWidth;
        let jaltonY = (this.halton(frameCounter, 3) - 0.5) / Engine.screenHeight;
        const jitteredProjectionMatrix = mat4.clone(projectionMatrix);
        
        const stableViewProjMattrix = mat4.create();
        mat4.multiply(stableViewProjMattrix, projectionMatrix, viewMatrix);
        this.frustumCulling.updateViewProjMatrix(stableViewProjMattrix);
        jitteredProjectionMatrix[8] = jaltonX;
        jitteredProjectionMatrix[9] = jaltonY;
        const currentViewProj = this.cameraData.subarray(0, 16);
        const newViewProj = mat4.create();
        mat4.multiply(newViewProj, jitteredProjectionMatrix, viewMatrix);
        this.cameraData.set(currentViewProj, 16); 
        this.cameraData.set(newViewProj, 0);   
        this.device.queue.writeBuffer(this.viewProjBuffer, 0, this.cameraData);
    }

    private halton(index: number, base: number): number {
        let f = 1;
        let r = 0;
        let current = index;
        
        while (current > 0) {
            f = f / base;
            r = r + f * (current % base);
            current = Math.floor(current / base);
        }
        
        return r;
    }

    public draw(
        commandEncoder: GPUCommandEncoder,
        albedoView: GPUTextureView,
        normalView: GPUTextureView,
        motionVectorView: GPUTextureView,
        depthView: GPUTextureView,
        world: World,
        entityRepository: EntityRepository,
        physicsFacade: PhysicsFacade, 
        timestampWrites?: any
    ): void {
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                { view: albedoView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' },
                { view: normalView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, loadOp: 'clear', storeOp: 'store' },
                { view: motionVectorView, clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }, loadOp: 'clear', storeOp: 'store' } 
            ],
            depthStencilAttachment: { view: depthView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' },
            timestampWrites
        });

        this.drawWorld(renderPass, world);
        this.drawEntities(renderPass, entityRepository, physicsFacade);

        renderPass.end();
    }

    private drawWorld(renderPass: GPURenderPassEncoder, world: World): void {
        renderPass.setPipeline(this.chunkPipeline);
        renderPass.setBindGroup(0, this.cameraBindGroup);
        renderPass.setBindGroup(3, this.chunkNormalMappingBindGroup);
        for (const chunk of world.chunks.values()) {
            if(this.frustumCulling.isFrustumCulled(chunk.getCenter(), chunk.getRadius())) continue;
            chunk.draw(renderPass);
        }

        for (let i = world.debri.length - 1; i >= 0; i--) {
            const debri = world.debri[i];
            if (!debri.isPersistent) { 
                debri.lifeTime += 16.67;
                if (debri.lifeTime > Debri.MAX_LIFETIME) {
                    world.removeDebri(debri);
                    globalEventBus.emit("PHYSICS_COMMAND", { type: 'REMOVE_BODY', id: debri.id});
                    debri.deleteGraphics();
                }
            }
        }

        if (world.debri.length === 0) return;

        renderPass.setPipeline(this.debriPipeline);
        renderPass.setBindGroup(0, this.debriCameraBindGroup);
        this.debriBatchManager.updateAndUploadModelMatrixes(world.debri);
        renderPass.setBindGroup(1, this.debriBatchManager.getBindGroup());
        renderPass.setBindGroup(3, this.debriNormalMappingBindGroup);

        for (let i = 0; i < world.debri.length; i++) {
            const debri = world.debri[i];
            if(!debri.isSingleBlockMesh()) debri.draw(renderPass, i); 
        }

        renderPass.setPipeline(this.smallDebriPipeline);
        renderPass.setBindGroup(0, this.smallDebriCameraBindGroup);
        const count = this.smallDebriBatchManager.updateAndUploadModelMatrixesandUvs(world.debri);
        renderPass.setBindGroup(1, this.smallDebriBatchManager.getBindGroup());
        renderPass.setBindGroup(3, this.smallDebriNormalMappingBindGroup);
        renderPass.setVertexBuffer(0, this.smallDebriBatchManager.getVertexBuffer().buffer);
        renderPass.setVertexBuffer(1, this.smallDebriBatchManager.getNormalBuffer().buffer);
        renderPass.draw(36, count, 0, 0);
    }

    private drawEntities(renderPass: GPURenderPassEncoder, entityRepository: EntityRepository, physicsFacade: PhysicsFacade): void {
        renderPass.setPipeline(this.entityPipeline);
        renderPass.setBindGroup(0, this.entityCameraBindGroup);

        for (const [entityId, renderComp] of entityRepository.renders.entries()) {
            
            let pos: vec3 | undefined = renderComp.position;
            let rot: quat | undefined = renderComp.rotation;

            const physComp = entityRepository.physics.get(entityId);
            if (physComp) {
                const transform = physicsFacade.transforms.get(physComp.bodyId);
                if (transform) {
                    pos = transform.position;
                    rot = transform.rotation;
                }
            }

            if (!pos || !rot) continue;

            const asset = AssetManager.getAsset(renderComp.modelId);
            if (!asset || !asset.mesh || asset.mesh.vertexCount === 0 || !asset.materialBindGroup) {
                continue;
            }

            const modelMatrix = mat4.create();
            mat4.translate(modelMatrix, modelMatrix, pos);
            const rotationMat = mat4.create();
            mat4.fromQuat(rotationMat, rot);
            mat4.multiply(modelMatrix, modelMatrix, rotationMat);
            
            if (renderComp.visualOffset) {
                mat4.translate(modelMatrix, modelMatrix, renderComp.visualOffset);
            }
            mat4.scale(modelMatrix, modelMatrix, renderComp.scale);

            let instanceData = this.entityBuffers.get(entityId);
            const dataArray = new Float32Array(36); 
            const isHighlightedValue = (this.currentHighlightedEntity === entityId) ? 1.0 : 0.0;

            if (!instanceData) {
                dataArray.set(modelMatrix as Float32Array, 0);
                dataArray.set(modelMatrix as Float32Array, 16); 
                dataArray[32] = isHighlightedValue;

                const buffer = new WebGPUUniformBuffer(this.device, dataArray);
                const bindGroup = this.device.createBindGroup({
                    layout: this.entityPipeline.getBindGroupLayout(2),
                    entries: [{ binding: 0, resource: { buffer: buffer.buffer } }]
                });
                instanceData = { buffer, bindGroup, lastMatrix: new Float32Array(modelMatrix), isHighlighted: isHighlightedValue };
                this.entityBuffers.set(entityId, instanceData);
            } else {
                dataArray.set(modelMatrix as Float32Array, 0);
                dataArray.set(instanceData.lastMatrix, 16);
                dataArray[32] = isHighlightedValue;
                
                if (isHighlightedValue !== instanceData.isHighlighted || !mat4.equals(modelMatrix, instanceData.lastMatrix)) {
                    instanceData.buffer.update(dataArray);
                    instanceData.lastMatrix.set(modelMatrix as Float32Array);
                    instanceData.isHighlighted = isHighlightedValue;
                }
            }

            renderPass.setBindGroup(1, asset.materialBindGroup);
            renderPass.setBindGroup(2, instanceData.bindGroup);
            asset.mesh.draw(renderPass);
        }
    }
}