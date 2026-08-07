export type PipelineType = 'CHUNK' | 'ENTITY' | 'DEBUG_LINES' | 'DEBRI' | 'DEFERRED' | 'SMALL_DEBRI';


interface PipelineConfig {
    label: string;
    topology?: GPUPrimitiveTopology;
    buffers: GPUVertexBufferLayout[];
}


const PIPELINE_CONFIGS: Record<PipelineType, PipelineConfig> = {
    CHUNK: {
        label: 'Chunk Forward Pipeline',
        topology: 'triangle-list',
        buffers: [
            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }] },
            { arrayStride: 12, attributes: [{ shaderLocation: 2, offset: 0, format: "float32x3" }] },
            { arrayStride: 8,  attributes: [{ shaderLocation: 3, offset: 0, format: "float32x2" }] }
        ]
    },
    ENTITY: {
        label: 'Entity Forward Pipeline',
        topology: 'triangle-list',
        buffers: [
            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
            { arrayStride: 8,  attributes: [{ shaderLocation: 1, offset: 0, format: "float32x2" }] },
            { arrayStride: 12, attributes: [{ shaderLocation: 2, offset: 0, format: "float32x3" }] }
        ]
    },
    DEBUG_LINES: {
        label: 'Debug Lines Pipeline',
        topology: 'line-list',
        buffers: [
            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
            { arrayStride: 16, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x4" }] }
        ]
    },
    DEBRI: {
        label: 'Debri Forward Pipeline',
        topology: 'triangle-list',
        buffers: [
            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }] },
            { arrayStride: 12, attributes: [{ shaderLocation: 2, offset: 0, format: "float32x3" }] },
            { arrayStride: 8,  attributes: [{ shaderLocation: 3, offset: 0, format: "float32x2" }] }
        ]
    },
    SMALL_DEBRI: {
        label: 'Small Debri Forward Pipeline',
        topology: 'triangle-list',
        buffers: [
            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }] }
        ]
    },
    DEFERRED: {
        label: 'Deferred Pipeline',
        topology: 'triangle-list',
        buffers: [] 
    }

};

export class WebGPUPipelineFactory {
    public static createPipeline(
        device: GPUDevice, 
        type: PipelineType, 
        shaderCode: string, 
        presentationFormat: GPUTextureFormat,
        gBuffer: boolean = false,
        needsDepthStencil: boolean = true
    ): GPURenderPipeline {

        const config = PIPELINE_CONFIGS[type];
        
        if (!config) {
            throw new Error(`Unsupported pipeline type: ${type}`);
        }

        const shaderModule = device.createShaderModule({ code: shaderCode });

        let fragmentTargets: GPUColorTargetState[] = [{ format: presentationFormat }];

        if (gBuffer) {
            fragmentTargets = [
                { format: "rgba8unorm" }, 
                { format: "rgba16float" }, 
            ];
        }


        let depthStencil: {
            format: "depth32float",
            depthWriteEnabled: boolean,
            depthCompare: GPUCompareFunction
        } | undefined = {
            format: "depth32float",
            depthWriteEnabled: true,
            depthCompare: "less"
        };

        if (!needsDepthStencil) {
            depthStencil = undefined;
        }


        return device.createRenderPipeline({
            label: config.label,
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: "vs_main",
                buffers: config.buffers 
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fs_main",
                targets: fragmentTargets
            },
            primitive: {
                topology: config.topology || "triangle-list",
                cullMode: "back",
                frontFace: "ccw"
            },
            depthStencil: depthStencil
        });
    }
}