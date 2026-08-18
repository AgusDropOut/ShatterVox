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
        vectorSearchRadius: f32,
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
        let motionVector = getBiggestVectorFromNeighboringVectors(in.uv);
        let pastUV = in.uv - motionVector;
        let pastColor = textureSample(historyTex, texSamplerLinear, pastUV);
        let finalColor = (currentPixelColor * params.alpha) + (pastColor * (1.0 - params.alpha));

        var out: TAAOutput;
        out.screenColor = vec4<f32>(finalColor); 
        out.historyColor = vec4<f32>(finalColor); 
        return out;
    }

    fn getBiggestVectorFromNeighboringVectors(uv: vec2<f32>) -> vec2<f32> {
        let xTexel = 1.0 / params.screenResolution.x;
        let yTexel = 1.0 / params.screenResolution.y;

        var currentBiggestSquaredLenght = 0.0;
        var biggestVector = vec2<f32>(0.0,0.0);

        for(var x = -i32(params.vectorSearchRadius); x <= i32(params.vectorSearchRadius) ; x = x + 1){
            
            for(var y = -i32(params.vectorSearchRadius); y <= i32(params.vectorSearchRadius) ; y = y + 1){

                let sampleUV = uv + vec2<f32>(f32(x) * xTexel, f32(y) * yTexel);

                let sampleMotionVector = textureSampleLevel(motionVectorTex, texSamplerLinear, sampleUV, 0.0).rg;

                let sampleLenght = (sampleMotionVector.x * sampleMotionVector.x) + (sampleMotionVector.y * sampleMotionVector.y);

                if(sampleLenght > currentBiggestSquaredLenght){
                    currentBiggestSquaredLenght = sampleLenght;
                    biggestVector = sampleMotionVector;
                }

            }

        }

        return biggestVector;

    }
`;