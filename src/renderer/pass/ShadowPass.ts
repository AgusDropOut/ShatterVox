import { WebGPUPipelineFactory } from "../WebGPUPipelineFactory";
import { shadowShaderWGSL } from "../shaders/ShadowShader.wgsl";
import type { WebGPUTexture } from "../WebGPUTexture";
import type { World } from "../../world/World";
import type { EntityRepository } from "../../entity/EntityRepository";
import type { PhysicsFacade } from "../../physics/PhysicsFacade";
import type { ParticlePass } from "../pass/ParticlePass";
import { AssetManager } from "../AssetManager";
import { FrustumCull } from "../FrustumCull";
import { mat4, vec3 } from "gl-matrix";
import type { quat } from "gl-matrix";
import { entityShadowShaderWGSL } from "../shaders/EntityShadowShader.wgsl";
import { WebGPUUniformBuffer } from "../WebGPUUniformBuffer";

export class ShadowPass {
    private device: GPUDevice;
    public shadowPipeline!: GPURenderPipeline;
    public entityShadowPipeline!: GPURenderPipeline;
    
    private shadowTexture!: GPUTexture;
    public shadowView!: GPUTextureView;
    public shadowSampler!: GPUSampler; 

    private sunCameraBuffer!: GPUBuffer;
    public cameraBindGroup!: GPUBindGroup;
    public entityCameraBindGroup!: GPUBindGroup;

    private entityShadowBuffers: Map<number, { buffer: WebGPUUniformBuffer, bindGroup: GPUBindGroup, lastMatrix: Float32Array }> = new Map();

    private frustumCulling!: FrustumCull;
    public readonly resolution = 4096; 
    public sunViewProjMatrix: mat4 = mat4.create();
    public sunViewMatrix: mat4 = mat4.create();
    public sunProjectionMatrix: mat4 = mat4.create();

    constructor(device: GPUDevice) {
        this.device = device;
        this.frustumCulling = new FrustumCull();
    }

    public init(atlas: WebGPUTexture): void {
        this.shadowTexture = this.device.createTexture({
            size: [this.resolution, this.resolution, 1],
            format: "depth32float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.shadowView = this.shadowTexture.createView();

        this.shadowSampler = this.device.createSampler({
            compare: 'less',
            magFilter: 'linear',
            minFilter: 'linear',
        });

        this.sunCameraBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.shadowPipeline = WebGPUPipelineFactory.createDepthPipeline(this.device, 'CHUNK_SHADOW', shadowShaderWGSL);
        this.entityShadowPipeline = WebGPUPipelineFactory.createDepthPipeline(this.device, 'ENTITY_SHADOW', entityShadowShaderWGSL);

        this.cameraBindGroup = this.device.createBindGroup({
            layout: this.shadowPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.sunCameraBuffer } },
                { binding: 1, resource: atlas.sampler },
                { binding: 2, resource: atlas.view }
            ]
        });

        this.entityCameraBindGroup = this.device.createBindGroup({
            layout: this.entityShadowPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.sunCameraBuffer } },
                { binding: 1, resource: atlas.sampler },
                { binding: 2, resource: atlas.view }
            ]
        });
    }

    public updateSunMatrix(
        sunDir: vec3, 
        targetPos: vec3, 
        frustum: number, 
        dist: number, 
        near: number, 
        far: number
    ): void {
        mat4.ortho(this.sunProjectionMatrix, -frustum, frustum, -frustum, frustum, near, far);

        const sunPos = vec3.create();
        vec3.scaleAndAdd(sunPos, targetPos, sunDir, -dist); 
        mat4.lookAt(this.sunViewMatrix, sunPos, targetPos, [0, 1, 0]);

        mat4.multiply(this.sunViewProjMatrix, this.sunProjectionMatrix, this.sunViewMatrix);
        this.frustumCulling.updateViewProjMatrix(this.sunViewProjMatrix);

        this.device.queue.writeBuffer(this.sunCameraBuffer, 0, this.sunViewProjMatrix as Float32Array);
    }

    public draw(
        commandEncoder: GPUCommandEncoder, 
        world: World, 
        entityRepository: EntityRepository, 
        physicsFacade: PhysicsFacade,
        particlePass?: ParticlePass,
        timestampWrites?: any
    ): void {
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [], 
            depthStencilAttachment: {
                view: this.shadowView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            },
            timestampWrites
        });

        pass.setPipeline(this.shadowPipeline);
        pass.setBindGroup(0, this.cameraBindGroup);

        for (const chunk of world.chunks.values()) {
            if (this.frustumCulling.isFrustumCulled(chunk.getCenter(), chunk.getRadius())) continue;
            chunk.draw(pass);
        }

        pass.setPipeline(this.entityShadowPipeline);
        pass.setBindGroup(0, this.entityCameraBindGroup);

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
            if (!asset || !asset.mesh) continue;

            const modelMatrix = mat4.create();
            mat4.translate(modelMatrix, modelMatrix, pos);
            const rotationMat = mat4.create();
            mat4.fromQuat(rotationMat, rot);
            mat4.multiply(modelMatrix, modelMatrix, rotationMat);
            
            if (renderComp.visualOffset) {
                mat4.translate(modelMatrix, modelMatrix, renderComp.visualOffset);
            }
            mat4.scale(modelMatrix, modelMatrix, renderComp.scale);

            let instanceData = this.entityShadowBuffers.get(entityId);
            if (!instanceData) {
                const buffer = new WebGPUUniformBuffer(this.device, modelMatrix as Float32Array);
                const bindGroup = this.device.createBindGroup({
                    layout: this.entityShadowPipeline.getBindGroupLayout(1),
                    entries: [{ binding: 0, resource: { buffer: buffer.buffer } }]
                });
                instanceData = { buffer, bindGroup, lastMatrix: new Float32Array(modelMatrix) };
                this.entityShadowBuffers.set(entityId, instanceData);
            } else {
                if (!mat4.equals(modelMatrix, instanceData.lastMatrix)) {
                    instanceData.buffer.update(modelMatrix as Float32Array);
                    instanceData.lastMatrix.set(modelMatrix as Float32Array);
                }
            }

            pass.setBindGroup(1, instanceData.bindGroup);

            for (const subMesh of asset.mesh.subMeshes) {
                asset.mesh.drawSubMesh(pass, subMesh);
            }
        }

        if (particlePass) {
            particlePass.drawShadows(pass);
        }

        pass.end();
    }
}