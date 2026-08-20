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
        vectorSearchRadius: f32,
        colorClampRadius: f32,
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
        let texelCoord = vec2<i32>(in.position.xy);
        let currentPixelColor = textureLoad(compositeTex, texelCoord, 0).rgb;

        let motionVector = getBiggestVectorFromNeighboringVectors(texelCoord);
        let pastUV = in.uv - motionVector;
        
        if (pastUV.x < 0.0 || pastUV.x > 1.0 || pastUV.y < 0.0 || pastUV.y > 1.0) {
            var out: TAAOutput;
            out.screenColor = vec4<f32>(currentPixelColor, 1.0); 
            out.historyColor = vec4<f32>(currentPixelColor, 1.0); 
            return out;
        }

        let pastColor = getNeighborClampedColor(texelCoord, pastUV);
        let finalColor = (currentPixelColor * params.alpha) + (pastColor.rgb * (1.0 - params.alpha));

        var out: TAAOutput;
        out.screenColor = vec4<f32>(finalColor, 1.0); 
        out.historyColor = vec4<f32>(finalColor, 1.0); 
        return out;
    }

    fn getBiggestVectorFromNeighboringVectors(baseCoord: vec2<i32>) -> vec2<f32> {
        var currentBiggestSquaredLenght = -1.0;
        var biggestVector = vec2<f32>(0.0, 0.0);

        for(var x = -i32(params.vectorSearchRadius); x <= i32(params.vectorSearchRadius) ; x = x + 1){
            for(var y = -i32(params.vectorSearchRadius); y <= i32(params.vectorSearchRadius) ; y = y + 1){
                let sampleCoord = baseCoord + vec2<i32>(x, y);

                let sampleMotionVector = textureLoad(motionVectorTex, sampleCoord, 0).rg;
                let sampleLenght = dot(sampleMotionVector, sampleMotionVector);

                if(sampleLenght > currentBiggestSquaredLenght){
                    currentBiggestSquaredLenght = sampleLenght;
                    biggestVector = sampleMotionVector;
                }
            }
        }

        return biggestVector;
    }

    fn toYCoCg(color: vec3<f32>) -> vec3<f32> {
        let Y = 0.25 * color.r + 0.5 * color.g + 0.25 * color.b;
        let Co = 0.50 * color.r - 0.5 * color.b;
        let Cg = -0.25 * color.r + 0.5 * color.g - 0.25 * color.b;
        return vec3<f32>(Y, Co, Cg);
    }

    fn toRGB(color: vec3<f32>) -> vec3<f32> {
        let R = color.r + color.g - color.b;
        let G = color.r + color.b;
        let B = color.r - color.g - color.b;
        return vec3<f32>(R, G, B);
    }

    fn getNeighborClampedColor(baseCoord: vec2<i32>, pastUV: vec2<f32>) -> vec4<f32> {
        var minY = 9999.0;
        var maxY = -9999.0;
        var minCo = 9999.0;
        var maxCo = -9999.0;
        var minCg = 9999.0;
        var maxCg = -9999.0;

        for(var x = -i32(params.colorClampRadius); x <= i32(params.colorClampRadius) ; x = x + 1){
            for(var y = -i32(params.colorClampRadius); y <= i32(params.colorClampRadius) ; y = y + 1){
                let sampleCoord = baseCoord + vec2<i32>(x, y);

                let sampleColor = textureLoad(compositeTex, sampleCoord, 0).rgb;
                let sampleYCoCg = toYCoCg(sampleColor);

                if(sampleYCoCg.r < minY){
                    minY = sampleYCoCg.r;
                }

                if(sampleYCoCg.r > maxY){
                    maxY = sampleYCoCg.r;
                }

                if(sampleYCoCg.g < minCo){
                    minCo = sampleYCoCg.g;
                }

                if(sampleYCoCg.g > maxCo){
                    maxCo = sampleYCoCg.g;
                }

                if(sampleYCoCg.b < minCg){
                    minCg = sampleYCoCg.b;
                }

                if(sampleYCoCg.b > maxCg){
                    maxCg = sampleYCoCg.b;
                }
            }
        }

        let maxColor = vec3<f32>(maxY, maxCo, maxCg);
        let minColor = vec3<f32>(minY, minCo, minCg);
        
        let pastColor = textureSample(historyTex, texSamplerLinear, pastUV);
        let pastColorinYCoCg = toYCoCg(pastColor.rgb);
        let validPastColorinYCoCg = clamp(pastColorinYCoCg, minColor, maxColor);
        let validPastColor = toRGB(validPastColorinYCoCg);
        
        return vec4<f32>(validPastColor, 1.0);
    }
`;