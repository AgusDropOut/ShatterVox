import { makeShaderDataDefinitions, makeStructuredView, type StructuredView } from "webgpu-utils";
import type { ParticleManager } from "../ParticleManager";
import { GeometryGenerator } from "../../geometry/GeometryGenerator";
import { Engine } from "../../core/Engine";
import { ParticleShaderWGSL } from "../shaders/ParticleShader.wgsl";
import { ParticleComputeShaderWGSL } from "../shaders/ParticleComputeShader.wgsl";
import { mat4 } from "gl-matrix";


export class ParticlePass {
    private computePipeline!: GPUComputePipeline;
    private renderPipeline!: GPURenderPipeline;

    private readonly device: GPUDevice;
    private particleRenderBindGroup!: GPUBindGroup;
    private particleComputeBindGroup!: GPUBindGroup;
    private computeParamsBindGroup!: GPUBindGroup;
    private renderParamsBindGroup!: GPUBindGroup;
    private computeBindGroup!: GPUBindGroup;

    private paramsBuffer!: GPUBuffer;
    private paramsView!: StructuredView;

    private particleManager: ParticleManager;

    private vertexBuffer!: GPUBuffer;
    private normalBuffer!: GPUBuffer;

    private presentationFormat: GPUTextureFormat;

    private cameraData: Float32Array = new Float32Array(32);

    constructor(device: GPUDevice, presentationFormat: GPUTextureFormat, particleManager: ParticleManager) {
        this.device = device;
        this.particleManager = particleManager;
        this.presentationFormat = presentationFormat;
        this.initPipelines();
        this.initBuffers();
        this.initBindGroups();

    }

    private initPipelines(): void {
        this.computePipeline = this.device.createComputePipeline({
            label: "Particle Compute Pipeline",
            layout: 'auto',
            compute: { module: this.device.createShaderModule({ code: ParticleComputeShaderWGSL }), entryPoint: 'main' }
        });

        this.renderPipeline = this.device.createRenderPipeline({
            label: "Particle Render Pipeline",
            layout: 'auto',
            vertex: {
                module: this.device.createShaderModule({ code: ParticleShaderWGSL }),
                entryPoint: 'vs_main',
                buffers: [
                    {
                        arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' }
                        ]
                    },
                    {
                        arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
                        attributes: [
                            { shaderLocation: 1, offset: 0, format: 'float32x3' }
                        ]
                    }
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: ParticleShaderWGSL }),
                entryPoint: 'fs_main',
                targets: [{ format: "rgba8unorm" }, { format: "rgba16float" }, { format: "rg16float" }],
            },
            depthStencil: {
                format: "depth32float",
                depthWriteEnabled: true,
                depthCompare: "less"
            },
            primitive: { topology: 'triangle-list' }
        });
    }

    private initBindGroups(): void {
         this.particleRenderBindGroup = this.device.createBindGroup({
            label: "Particle Render Bind Group",
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.particleManager.getParticleBuffer() } }]
        });

        this.particleComputeBindGroup = this.device.createBindGroup({
            label: "Particle Compute Bind Group",
            layout: this.computePipeline.getBindGroupLayout(2),
            entries: [{ binding: 0, resource: { buffer: this.particleManager.getParticleBuffer() } }]
        });
    }

    private initBuffers(): void {
            const defs = makeShaderDataDefinitions(`
                struct GTAOParams {
                    screenResolution: vec2<f32>,
                    inverseProjectionMatrix: mat4x4<f32>,
                    projectionMatrix: mat4x4<f32>,
                    viewMatrix: mat4x4<f32>,
                    viewProjMatrix: mat4x4<f32>,
                    prevViewProjMatrix: mat4x4<f32>, 
                };
            `);
            this.paramsView = makeStructuredView(defs.structs.GTAOParams);
            this.paramsBuffer = this.device.createBuffer({
                label: "Particle Params Uniform Buffer",
                size: this.paramsView.arrayBuffer.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            this.vertexBuffer = this.device.createBuffer({
                label: "Particle Vertex Buffer",
                size: 36 * 3 * Float32Array.BYTES_PER_ELEMENT,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            this.normalBuffer = this.device.createBuffer({
                label: "Particle Normal Buffer",
                size: 36 * 3 * Float32Array.BYTES_PER_ELEMENT,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            this.device.queue.writeBuffer(this.vertexBuffer, 0, GeometryGenerator.getCubePositionsScaled(Engine.voxelSize / 2));
            this.device.queue.writeBuffer(this.normalBuffer, 0, GeometryGenerator.getCubeNormals());
    }

    public updateParams(width: number, height: number, viewMatrix: Float32Array, projMatrix: Float32Array, invProjMatrix: Float32Array, frameCounter: number): void {
        let jaltonX = (this.halton(frameCounter, 2) - 0.5) / Engine.screenWidth;
        let jaltonY = (this.halton(frameCounter, 3) - 0.5) / Engine.screenHeight;
        const jitteredProjectionMatrix = mat4.clone(projMatrix);
                
        const stableViewProjMattrix = mat4.create();
        mat4.multiply(stableViewProjMattrix, projMatrix, viewMatrix);
        //this.frustumCulling.updateViewProjMatrix(stableViewProjMattrix);
        jitteredProjectionMatrix[8] = jaltonX;
        jitteredProjectionMatrix[9] = jaltonY;
        const currentViewProj = this.cameraData.subarray(0, 16);
        const newViewProj = mat4.create();
        mat4.multiply(newViewProj, jitteredProjectionMatrix, viewMatrix);
        this.cameraData.set(currentViewProj, 16); 
        this.cameraData.set(newViewProj, 0);   
        
        

        this.paramsView.set({
            screenResolution: [width, height],
            inverseProjectionMatrix: invProjMatrix,
            projectionMatrix: projMatrix,
            viewMatrix: viewMatrix,
            viewProjMatrix: newViewProj,
            prevViewProjMatrix: currentViewProj,

        });
        this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsView.arrayBuffer);
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

    public resize( depthView: GPUTextureView, normalView: GPUTextureView): void {

        this.computeBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: depthView },
                { binding: 1, resource: normalView },
                
            ]
        });

        this.computeParamsBindGroup = this.device.createBindGroup({
            layout: this.computePipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.paramsBuffer } }]
        });

        this.renderParamsBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.paramsBuffer } }]
        });

       
    }

    public computeParticles(commandEncoder: GPUCommandEncoder, timestampWrites?: any): void {
        const passEncoder = commandEncoder.beginComputePass({timestampWrites: timestampWrites});
        passEncoder.setPipeline(this.computePipeline);
        passEncoder.setBindGroup(0, this.computeBindGroup);
        passEncoder.setBindGroup(1, this.computeParamsBindGroup);
        passEncoder.setBindGroup(2, this.particleComputeBindGroup);
        const workgroupCount = Math.ceil(this.particleManager.maxParticles / 64);
        passEncoder.dispatchWorkgroups(workgroupCount);
        passEncoder.end();
    }

    public drawParticles(commandEncoder: GPUCommandEncoder, albedoView: GPUTextureView, normalView: GPUTextureView, motionView: GPUTextureView, depthView: GPUTextureView, timestampWrites?: any): void {
        const passEncoder = commandEncoder.beginRenderPass({ 
            colorAttachments: [
                { view: albedoView, clearValue: [0, 0, 0, 1], loadOp: 'load', storeOp: 'store' },
                { view: normalView, clearValue: [0, 0, 0, 1], loadOp: 'load', storeOp: 'store' },
                { view: motionView, clearValue: [0, 0, 0, 1], loadOp: 'load', storeOp: 'store' },
            ],
            depthStencilAttachment: {
                view: depthView,
                depthClearValue: 1.0,
                depthLoadOp: 'load',
                depthStoreOp: 'store',
            },
            timestampWrites: timestampWrites 
        });
        passEncoder.setPipeline(this.renderPipeline);
        passEncoder.setBindGroup(0, this.particleRenderBindGroup);
        passEncoder.setBindGroup(1, this.renderParamsBindGroup);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.setVertexBuffer(1, this.normalBuffer);
        passEncoder.draw(36, this.particleManager.maxParticles, 0, 0);
        passEncoder.end();
    }


}
        