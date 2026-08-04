export type PipelineType = 'CHUNK' | 'ENTITY' | 'DEBUG_LINES' | 'DEBRI';


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
    }
};

export class WebGPUPipelineFactory {
    public static createPipeline(
        device: GPUDevice, 
        type: PipelineType, 
        shaderCode: string, 
        presentationFormat: GPUTextureFormat
    ): GPURenderPipeline {

        const config = PIPELINE_CONFIGS[type];
        
        if (!config) {
            throw new Error(`Unsupported pipeline type: ${type}`);
        }

        const shaderModule = device.createShaderModule({ code: shaderCode });

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
                targets: [{ format: presentationFormat }]
            },
            primitive: {
                topology: config.topology || "triangle-list",
                cullMode: "back",
                frontFace: "ccw"
            },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: true,
                depthCompare: "less"
            }
        });
    }
}