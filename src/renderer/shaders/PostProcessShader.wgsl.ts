export const postProcessShaderWGSL = `
struct PostProcessParams {
    exposure: f32,
    gamma: f32,
    contrast: f32,
    saturation: f32,
    toneMappingMethod: u32,
};

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: PostProcessParams;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
    );
    var uv = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
        vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
    );
    
    var output: VertexOutput;
    output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    output.uv = uv[vertexIndex];
    return output;
}

fn ACESFilm(x: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn Reinhard(x: vec3<f32>) -> vec3<f32> {
    return x / (1.0 + x);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    var color = textureSample(inputTexture, texSampler, in.uv).rgb;

    color = color * params.exposure;

    if (params.toneMappingMethod == 1u) {
        color = ACESFilm(color);
    } else if (params.toneMappingMethod == 2u) {
        color = Reinhard(color);
    }

    color = (color - 0.5) * params.contrast + 0.5;
    color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));

    let luminance = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
    color = mix(vec3<f32>(luminance), color, params.saturation);

    color = pow(color, vec3<f32>(1.0 / params.gamma));

    return vec4<f32>(color, 1.0);
}
    `