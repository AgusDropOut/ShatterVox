import { MotionVectorMath } from "./WGSLModules";

export const entityShaderWGSL = `
    struct Camera { 
        viewProj: mat4x4<f32>,
        prevViewProj: mat4x4<f32>, 
    };
    @group(0) @binding(0) var<uniform> camera: Camera;

    @group(1) @binding(0) var textureSampler: sampler;
    @group(1) @binding(1) var entityTexture: texture_2d<f32>;

    struct Model { 
        matrix: mat4x4<f32>,
        prevMatrix: mat4x4<f32>, 
    };

    @group(2) @binding(0) var<uniform> model: Model;

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) currentClipPos: vec4<f32>,
        @location(3) previousClipPos: vec4<f32>,
    };

    @vertex
    fn vs_main(
        @location(0) pos: vec3<f32>,
        @location(1) uv: vec2<f32>,
        @location(2) normal: vec3<f32>
    ) -> VertexOutput {
        var out: VertexOutput;
        let localPos = vec4<f32>(pos, 1.0);
        
        out.currentClipPos = camera.viewProj * model.matrix * localPos;
        out.previousClipPos = camera.prevViewProj * model.prevMatrix * localPos;
        
        out.position = out.currentClipPos;
        out.uv = vec2<f32>(uv.x, 1.0 - uv.y);
        out.normal = normal;
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
        let texColor = textureSample(entityTexture, textureSampler, in.uv);
        
        if (texColor.a < 0.1) { discard; }

        output.albedo = texColor;
        output.normal = vec4<f32>(normalize(in.normal), 1.0);
        output.motion = calculateMotionVector(in.currentClipPos, in.previousClipPos);

        return output;
    }
`;