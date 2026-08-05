const quadVertex = `
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
    };

    @vertex
    fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        var pos = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0,  1.0),
            vec2<f32>(-1.0,  1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0,  1.0)
        );
        var uv = array<vec2<f32>, 6>(
            vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
            vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
        );
        var out: VertexOutput;
        out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
        out.uv = uv[vertexIndex];
        return out;
    }
`;

export const debugColorQuadShaderWGSL = quadVertex + `
    @group(0) @binding(0) var texSampler: sampler;
    @group(0) @binding(1) var tex: texture_2d<f32>;

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        return textureSample(tex, texSampler, in.uv);
    }
`;

export const debugDepthQuadShaderWGSL = quadVertex + `
    @group(0) @binding(0) var texSampler: sampler;
    @group(0) @binding(1) var tex: texture_depth_2d;

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let depth = textureSample(tex, texSampler, in.uv);
        let visible = (1.0 - depth) * 50.0;
        return vec4<f32>(visible, visible, visible, 1.0);
    }
`;