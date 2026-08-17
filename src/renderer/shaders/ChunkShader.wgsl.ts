import { MotionVectorMath } from "./WGSLModules";

export const chunkShaderWGSL = `

    struct Camera {
        viewProj: mat4x4<f32>,
        prevViewProj: mat4x4<f32>, 
    };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var textureSampler: sampler;
    @group(0) @binding(2) var atlasTexture: texture_2d<f32>;

  
    struct Model {
        matrix: mat4x4<f32>,
    };
    @group(1) @binding(0) var<uniform> model: Model;

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
        @location(1) color: vec3<f32>,
        @location(2) normal: vec3<f32>,
        @location(3) currentClipPos: vec4<f32>, 
        @location(4) previousClipPos: vec4<f32>
    };

    @vertex
    fn vs_main(
        @location(0) pos: vec3<f32>,
        @location(1) norm: vec3<f32>,
        @location(2) col: vec3<f32>,
        @location(3) uv: vec2<f32>
    ) -> VertexOutput {
        var out: VertexOutput;
        let worldPos = model.matrix * vec4<f32>(pos, 1.0);
        
        out.currentClipPos = camera.viewProj * worldPos;
        out.previousClipPos = camera.prevViewProj * worldPos; 
        
        out.position = out.currentClipPos;
        out.uv = uv;
        out.color = col;
        out.normal = norm;
        return out;
    }

    struct GBufferOutput {
        @location(0) albedo: vec4<f32>,
        @location(1) normal: vec4<f32>,
        @location(2) motion: vec2<f32>
    };

    ${MotionVectorMath}

    @fragment
    fn fs_main(in: VertexOutput) -> GBufferOutput {
        var output: GBufferOutput;
        let texColor = textureSample(atlasTexture, textureSampler, in.uv);

        if(texColor.a < 0.1) { discard; }
        
        output.albedo = texColor;
        output.normal = vec4<f32>(normalize(in.normal), 1.0);
        output.motion = calculateMotionVector(in.currentClipPos, in.previousClipPos); // NUEVO
    
        return output;
    }
`;