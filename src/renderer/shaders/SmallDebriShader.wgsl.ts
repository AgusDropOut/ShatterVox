import { MotionVectorMath } from "./WGSLModules";

export const smallDebriShaderWGSL = `
    struct Camera {
        viewProj: mat4x4<f32>,
        prevViewProj: mat4x4<f32>,
    };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var textureSampler: sampler;
    @group(0) @binding(2) var atlasTexture: texture_2d<f32>;

    struct DebriData {
        matrix: mat4x4<f32>,
        prevMatrix: mat4x4<f32>,
        uvs: array<vec2<f32>, 36>
    };
    @group(1) @binding(0) var<storage, read> debriBuffer: array<DebriData>;

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) normal: vec3<f32>,
        @location(1) uv: vec2<f32>,
        @location(2) currentClipPos: vec4<f32>,
        @location(3) previousClipPos: vec4<f32>,
    };

    @vertex
    fn vs_main(
        @location(0) pos: vec3<f32>,
        @location(1) norm: vec3<f32>,
        @builtin(instance_index) instanceIndex: u32,
        @builtin(vertex_index) vertexIndex: u32
    ) -> VertexOutput {
        var out: VertexOutput;
        let localPos = vec4<f32>(pos, 1.0);
        let modelMatrix = debriBuffer[instanceIndex].matrix;
        let prevModelMatrix = debriBuffer[instanceIndex].prevMatrix;
        
        let normalMatrix = mat3x3<f32>(
            modelMatrix[0].xyz,
            modelMatrix[1].xyz,
            modelMatrix[2].xyz
        );

        out.currentClipPos = camera.viewProj * modelMatrix * localPos;
        out.previousClipPos = camera.prevViewProj * prevModelMatrix * localPos;

        out.position = out.currentClipPos;
        out.uv = debriBuffer[instanceIndex].uvs[vertexIndex];
        out.normal = normalMatrix * norm;
        
        return out;
    }

    struct GBufferOutput {
        @location(0) albedo: vec4<f32>,
        @location(1) normal: vec4<f32>,
        @location(2) motion: vec2<f32>,
    };

    ${MotionVectorMath}

    @fragment
    fn fs_main(in: VertexOutput) -> GBufferOutput {
        var output: GBufferOutput;

        let texColor = textureSample(atlasTexture, textureSampler, in.uv);
        if(texColor.a < 0.1) { discard; }
        
        output.albedo = texColor;
        output.normal = vec4<f32>(normalize(in.normal), 1.0);
        output.motion = calculateMotionVector(in.currentClipPos, in.previousClipPos);

        return output;
    }
`;