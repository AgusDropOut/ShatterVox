export const entityShaderWGSL = `
    struct Camera { viewProj: mat4x4<f32> };
    @group(0) @binding(0) var<uniform> camera: Camera;

    @group(1) @binding(0) var textureSampler: sampler;
    @group(1) @binding(1) var entityTexture: texture_2d<f32>;

    struct Model { matrix: mat4x4<f32> };
    @group(2) @binding(0) var<uniform> model: Model;

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
        @location(1) normal: vec3<f32>,
    };

    @vertex
    fn vs_main(
        @location(0) pos: vec3<f32>,
        @location(1) uv: vec2<f32>,
        @location(2) normal: vec3<f32>
    ) -> VertexOutput {
        var out: VertexOutput;
        out.position = camera.viewProj * model.matrix * vec4<f32>(pos, 1.0);
        out.uv = vec2<f32>(uv.x, 1.0 - uv.y);
        out.normal = normal;
        return out;
    }

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let texColor = textureSample(entityTexture, textureSampler, in.uv);
        if (texColor.a < 0.1) { discard; }
        let light = max(dot(normalize(in.normal), vec3<f32>(0.5, 1.0, 0.2)), 0.3);
        return vec4<f32>(texColor.rgb * light, texColor.a);
    }
`;