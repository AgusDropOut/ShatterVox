export const TAAShaderWGSL = `
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

    struct TAAParams {
        screenResolution: vec2<f32>,
        alpha: f32,
        padding: f32,
    };

    @group(0) @binding(0) var texSamplerLinear: sampler;
    @group(0) @binding(1) var compositeTex: texture_2d<f32>;
    @group(0) @binding(2) var motionVectorTex: texture_2d<f32>;
    @group(0) @binding(3) var historyTex: texture_2d<f32>;
    @group(0) @binding(4) var<uniform> params: TAAParams;

    struct TAAOutput {
        @location(0) screenColor: vec4<f32>,
        @location(1) historyColor: vec4<f32>,
    };

    @fragment
    fn fs_main(in: VertexOutput) -> TAAOutput {
       
        
        let currentPixelColor = textureSample(compositeTex, texSamplerLinear, in.uv);
        let motionVector = textureSample(motionVectorTex, texSamplerLinear, in.uv).rg;
        let pastUV = in.uv - motionVector;
        let pastColor = textureSample(historyTex, texSamplerLinear, pastUV);
        let finalColor = (currentPixelColor * params.alpha) + (pastColor * (1.0 - params.alpha));

        var out: TAAOutput;
        out.screenColor = vec4<f32>(finalColor); 
        out.historyColor = vec4<f32>(finalColor); 
        return out;
    }
`;