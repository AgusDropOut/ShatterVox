export const shadowShaderWGSL = `
struct SunCamera {
    viewProj: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> sunCamera: SunCamera;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var atlasTexture: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(
    @location(0) pos: vec3<f32>,
    @location(1) norm: vec4<f32>,
    @location(2) col: vec4<f32>,
    @location(3) uv: vec2<f32>
) -> VertexOutput {
    var out: VertexOutput;
    out.position = sunCamera.viewProj * vec4<f32>(pos, 1.0);
    out.uv = uv;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) {
    let texColor = textureSample(atlasTexture, textureSampler, in.uv);
    if (texColor.a < 0.1) { 
        discard; 
    }
}
`;