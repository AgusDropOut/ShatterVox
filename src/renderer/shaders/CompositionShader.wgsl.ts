
export const compositionShaderWGSL = `
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

    @group(0) @binding(0) var texSamplerLinear: sampler;
    @group(0) @binding(1) var deferredTex: texture_2d<f32>;
    @group(0) @binding(2) var albedoTex: texture_2d<f32>;
    @group(0) @binding(3) var blurredSSGITex: texture_2d<f32>;

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let directLight = textureSample(deferredTex, texSamplerLinear, in.uv).rgb;
        let albedo = textureSample(albedoTex, texSamplerLinear, in.uv).rgb;
        let indirectLight = textureSample(blurredSSGITex, texSamplerLinear, in.uv).rgb;

        let finalColor = directLight + ((indirectLight * 0.8)  );

        return vec4<f32>(finalColor, 1.0);
    }
`;