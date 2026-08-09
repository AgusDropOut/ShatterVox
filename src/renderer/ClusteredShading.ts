import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';
import type { StructuredView } from 'webgpu-utils';
import { mat4 } from 'gl-matrix';
import { clusteredShadingComputeShaderWGSL } from './shaders/ClusteredShadingComputeShader.wgsl';
import { Engine } from '../core/Engine';
import { clusteredShadingLightsToClustersComputeShaderWGSL } from './shaders/ClusteredShadingLightsToClustersComputeShader.wgsl copy';
import type { LightManager } from './LightManager';

export class ClusteredShading {
    private readonly device: GPUDevice;
    private readonly clusterBuffer: GPUBuffer;
    private readonly paramsBuffer: GPUBuffer;
    private computeClustersPipeline: GPUComputePipeline;
    private computeLightsToClustersPipeline: GPUComputePipeline;
    private readonly bindGroup: GPUBindGroup;
    private readonly lightToClusterClustersBindGroup: GPUBindGroup;
    private readonly lightToClusterLightSourcesBindGroup: GPUBindGroup;
    private readonly lightToClusterViewMatrixBindGroup: GPUBindGroup;

    private readonly paramsView: StructuredView;

    private readonly GRID_X = 12;
    private readonly GRID_Y = 12;
    private readonly GRID_Z = 32;
    private readonly WORKGROUP_SIZE_X = 8;
    private readonly WORKGROUP_SIZE_Y = 8;
    private readonly WORKGROUP_SIZE_Z = 1;
    private readonly CLUSTER_SIZE_BYTES = 848;
    private readonly TOTAL_CLUSTERS = this.GRID_X * this.GRID_Y * this.GRID_Z;

    private lightManager: LightManager;

    constructor(device: GPUDevice, lightManager: LightManager, viewMatrixBuffer: GPUBuffer) {
        this.device = device;
        this.lightManager = lightManager;

        const defs = makeShaderDataDefinitions(clusteredShadingComputeShaderWGSL);
        this.paramsView = makeStructuredView(defs.structs.ClusterParams);

        const shaderModule = device.createShaderModule({
            code: clusteredShadingComputeShaderWGSL,
        });

        const computeLightsToClustersShaderModule = device.createShaderModule({
            code: clusteredShadingLightsToClustersComputeShaderWGSL,
        });



        this.computeClustersPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main',
            },
        });

        this.computeLightsToClustersPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: computeLightsToClustersShaderModule,
                entryPoint: 'main',
            },
        });

        this.clusterBuffer = device.createBuffer({
            label: "Cluster Storage Buffer",
            size: this.TOTAL_CLUSTERS * this.CLUSTER_SIZE_BYTES,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.paramsBuffer = device.createBuffer({
            label: "Cluster Params Uniform Buffer",
            size: this.paramsView.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bindGroup = device.createBindGroup({
            layout: this.computeClustersPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.clusterBuffer } },
                { binding: 1, resource: { buffer: this.paramsBuffer } }
            ]
        });

        this.lightToClusterClustersBindGroup = device.createBindGroup({
            layout: this.computeLightsToClustersPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.clusterBuffer } },
            ]
        });

        const lightBufferSources = this.lightManager.getLightBufferSources();
        this.lightToClusterLightSourcesBindGroup = device.createBindGroup({
            layout: this.computeLightsToClustersPipeline.getBindGroupLayout(1),
            entries: [
                { binding: 0, resource: { buffer: lightBufferSources.lightBuffer } },
                { binding: 1, resource: { buffer: lightBufferSources.lightAmountBuffer } }
            ]
        });

        this.lightToClusterViewMatrixBindGroup = device.createBindGroup({
            layout: this.computeLightsToClustersPipeline.getBindGroupLayout(2),
            entries: [
                { binding: 0, resource: { buffer: viewMatrixBuffer } }
            ]
        });



        this.updateParamsBuffer();
    }

    public updateParamsBuffer(): void {
        const inverseProjectionMatrix = mat4.create();
        mat4.invert(inverseProjectionMatrix, Engine.projectionMatrix);

        this.paramsView.set({
            inverseProjectionMatrix: inverseProjectionMatrix as Float32Array,
            gridSize: [this.GRID_X, this.GRID_Y, this.GRID_Z],
            zNear: Engine.zNear,
            screenResolution: [Engine.screenWidth, Engine.screenHeight],
            zFar: Engine.zFar
        });

        this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsView.arrayBuffer);
    }

    public createClusters(): void {
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        
        passEncoder.setPipeline(this.computeClustersPipeline);
        passEncoder.setBindGroup(0, this.bindGroup);

        const workgroupCountX = Math.ceil(this.GRID_X / this.WORKGROUP_SIZE_X);
        const workgroupCountY = Math.ceil(this.GRID_Y / this.WORKGROUP_SIZE_Y);
        const workgroupCountZ = Math.ceil(this.GRID_Z / this.WORKGROUP_SIZE_Z);

        passEncoder.dispatchWorkgroups(workgroupCountX, workgroupCountY, workgroupCountZ);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    public assignLightsToClusters(encoder: GPUCommandEncoder): void {
        const passEncoder = encoder.beginComputePass();

        passEncoder.setPipeline(this.computeLightsToClustersPipeline);
        passEncoder.setBindGroup(0, this.lightToClusterClustersBindGroup);
        passEncoder.setBindGroup(1, this.lightToClusterLightSourcesBindGroup);
        passEncoder.setBindGroup(2, this.lightToClusterViewMatrixBindGroup);

        const workgroupCount = Math.ceil(this.TOTAL_CLUSTERS / 64);
        passEncoder.dispatchWorkgroups(workgroupCount, 1, 1);
        passEncoder.end();

    }

    public getClusterBuffer(): GPUBuffer {
        return this.clusterBuffer;
    }

    public getParamsBuffer(): GPUBuffer {
        return this.paramsBuffer;
    }
}