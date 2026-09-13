export const entityShadowShaderWGSL = `
struct SunCamera {
    viewProj: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> sunCamera: SunCamera;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var atlasTexture: texture_2d<f32>;

struct Model {
    matrix: mat4x4<f32>,
};

@group(1) @binding(0) var<uniform> model: Model;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(
    @location(0) pos: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) normal: vec3<f32>
) -> VertexOutput {
    var out: VertexOutput;
    let worldPos = model.matrix * vec4<f32>(pos, 1.0);
    out.position = sunCamera.viewProj * worldPos;
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