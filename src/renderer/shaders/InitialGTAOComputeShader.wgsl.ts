export const InitialGTAOComputeShaderWGSL = `

    struct GTAOParams {
        screenResolution: vec2<f32>,
        zNear: f32,
        zFar: f32,
        inverseProjectionMatrix: mat4x4<f32>,
        projectionMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>,
        radius: f32,
        falloff: f32,
        thickness: f32,
        blurRadius: f32,
        blurSharpness: f32,
    };

    @group(0) @binding(0) var texSamplerNearest: sampler;
    @group(0) @binding(1) var normalTex: texture_2d<f32>;
    @group(0) @binding(2) var depthTex: texture_depth_2d;
    @group(0) @binding(3) var noisyGTAO: texture_storage_2d<rgba8unorm, write>;

    @group(1) @binding(0) var<uniform> params: GTAOParams;

    const MIN_RADIUS_PIXELS: f32 = 1.0; 
    const MAX_RADIUS_PIXELS: f32 = 128.0; 
    const NUM_SLICES: u32 = 2u;
    const MAX_STEPS: u32 = 3u;

    @compute @workgroup_size(8, 8, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        if (global_id.x >= u32(params.screenResolution.x) || global_id.y >= u32(params.screenResolution.y)) {
            return;
        }
        let pixelCoords = vec2<i32>(global_id.xy);
        let pixelDepth = textureLoad(depthTex, pixelCoords, 0);
        let pixelNormalWorld = textureLoad(normalTex, pixelCoords, 0).xyz;
        let pixelNormalView = normalize((params.viewMatrix * vec4<f32>(pixelNormalWorld, 0.0)).xyz);

        if (pixelDepth >= 1.0) {
            textureStore(noisyGTAO, vec2<i32>(global_id.xy), vec4<f32>(1.0, 0.0, 0.0, 1.0));
            return;
        }

        let pixelPositionView = getViewSpacePosition(global_id.xy, pixelDepth);

        let focalPixels = params.projectionMatrix[0][0] * params.screenResolution.x / 2.0;
        let radiusPixels = clamp(params.radius * focalPixels / abs(pixelPositionView.z), MIN_RADIUS_PIXELS, MAX_RADIUS_PIXELS);

        let deltaTheta = 3.14159265359 / f32(NUM_SLICES);

        let currentUV = (vec2<f32>(global_id.xy) + 0.5) / params.screenResolution;
        var totalVisibility: f32 = 0.0;
        for(var s: u32 = 0u; s < NUM_SLICES; s++) {
            let theta = (f32(s) + interleavedGradientNoise(vec2<f32>(f32(global_id.x), f32(global_id.y)))) * deltaTheta;
            let direction = vec2<f32>(cos(theta), sin(theta));
            var maxHorizon1: f32 = -1.0;
            var maxHorizon2: f32 = -1.0;

            for(var step: u32 = 1u; step <= MAX_STEPS; step++) {
                let stepProgress = (f32(step) - 0.5 + (interleavedGradientNoise(vec2<f32>(f32(global_id.x), f32(global_id.y))) * 0.5)) / f32(MAX_STEPS);
                let pixelOffset = radiusPixels * stepProgress;
                
                let sampleUV1 = currentUV + (direction * pixelOffset) / params.screenResolution;
                let sampleUV2 = currentUV - (direction * pixelOffset) / params.screenResolution;
                
                let sampleDepth1 = textureSampleLevel(depthTex, texSamplerNearest, sampleUV1, 0);

                if(sampleDepth1 < 1.0) {
                    let viewPosSample1 = getViewSpacePosition(vec2<u32>(sampleUV1 * params.screenResolution), sampleDepth1);
                    let delta1 = viewPosSample1 - pixelPositionView;
                    let elevationAngle1 = dot(normalize(delta1), pixelNormalView);
                    if(length(delta1) < params.radius && elevationAngle1 > maxHorizon1) {
                        maxHorizon1 = elevationAngle1;
                    }
                }

                let sampleDepth2 = textureSampleLevel(depthTex, texSamplerNearest, sampleUV2, 0);

                if(sampleDepth2 < 1.0) {

                    let viewPosSample2 = getViewSpacePosition(vec2<u32>(sampleUV2 * params.screenResolution), sampleDepth2);
                    let delta2 = viewPosSample2 - pixelPositionView;
                    let elevationAngle2 = dot(normalize(delta2), pixelNormalView);
                    if(length(delta2) < params.radius && elevationAngle2 > maxHorizon2) {
                        maxHorizon2 = elevationAngle2;
                    }

                }

            }
            let sliceVisibility = 1.0 - (clamp(maxHorizon1, 0.0, 1.0) + clamp(maxHorizon2, 0.0, 1.0)) / 2.0;
            totalVisibility += sliceVisibility;

        }

        let finalVisibility = totalVisibility / f32(NUM_SLICES);
        textureStore(noisyGTAO, vec2<i32>(global_id.xy), vec4<f32>(finalVisibility, 0.0, 0.0, 1.0));
        
    }

    fn getViewSpacePosition(pixelCoords: vec2<u32>, depth: f32) -> vec3<f32> {
        let ndcX = ((f32(pixelCoords.x) + 0.5) / params.screenResolution.x) * 2.0 - 1.0;
        let ndcY = 1.0 - ((f32(pixelCoords.y) + 0.5) / params.screenResolution.y) * 2.0;
        let viewPosH = (params.inverseProjectionMatrix * vec4<f32>(ndcX, ndcY, depth, 1.0));
        return viewPosH.xyz / viewPosH.w;
    }

    fn interleavedGradientNoise(seed: vec2<f32>) -> f32 {
        let magicVector = vec2<f32>(0.06711056, 0.00583715);
        return fract(52.9829189 * fract(dot(seed, magicVector)));
    }
`;