export const SSGIComputeShaderWGSL = `

    struct SSGIParams {
        projectionMatrix: mat4x4<f32>,
        inverseProjectionMatrix: mat4x4<f32>,
        inverseViewMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>,
        screenResolution: vec2<f32>,
        rayStepSize: f32,
        maxSteps: u32,
        thickness: f32,
        frameCounter: u32,
    };

    @group(0) @binding(0) var texSamplerLinear: sampler;
    @group(0) @binding(1) var texSamplerNearest: sampler;

    @group(1) @binding(0) var depthTex: texture_depth_2d;
    @group(1) @binding(1) var normalTex: texture_2d<f32>;
    @group(1) @binding(2) var litSceneTex: texture_2d<f32>;
    @group(1) @binding(3) var ssgiOutput: texture_storage_2d<rgba16float, write>;

    @group(2) @binding(0) var<uniform> params: SSGIParams;

    @compute @workgroup_size(8, 8, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        if (global_id.x >= u32(params.screenResolution.x) || global_id.y >= u32(params.screenResolution.y)) {
            return;
        }
        let pixelCoords = vec2<i32>(global_id.xy);
        let pixelDepth = textureLoad(depthTex, pixelCoords, 0);
        if(pixelDepth == 1.0) {
            textureStore(ssgiOutput, pixelCoords, vec4<f32>(0.0, 0.0, 0.0, 1.0));
            return;
        }
        
        let pixelNormalWorld = textureLoad(normalTex, pixelCoords, 0).xyz;
        let pixelNormalView = normalize((params.viewMatrix * vec4<f32>(pixelNormalWorld, 0.0)).xyz);

        let noise1 = interleavedGradientNoisePixel(vec2<f32>(pixelCoords), params.frameCounter);
        let noise2 = interleavedGradientNoisePixel(vec2<f32>(pixelCoords) + vec2<f32>(47.0, 17.0), params.frameCounter);

        let tetha = acos(sqrt(1.0 - noise1));
        let phi = 2.0 * 3.14159265358979323846 * noise2;
        let sampleTangent= vec3<f32>(
            sin(tetha) * cos(phi),
            sin(tetha) * sin(phi),
            cos(tetha)
        );
        
        var randomVector = vec3<f32>(1.0, 0.0, 0.0);

        if(abs(dot(randomVector, pixelNormalView)) > 0.99) {
            randomVector = vec3<f32>(0.0, 1.0, 0.0);
        }

        let firstBiTangent = normalize(cross(pixelNormalView, randomVector));
        let secondBiTangent = normalize(cross(pixelNormalView, firstBiTangent));

        let matrixTBN = mat3x3<f32>(
            firstBiTangent,
            secondBiTangent,
            pixelNormalView
        );

        let sampleDirectionView = normalize(matrixTBN * sampleTangent);

        let rayOriginView = getViewSpacePosition(global_id.xy, pixelDepth) + (pixelNormalView * 0.05);
        let endPointView = rayOriginView + sampleDirectionView * 10.0;

        let homogeneousOrigin = params.projectionMatrix * vec4<f32>(rayOriginView, 1.0);
        let homogeneousEndPoint = params.projectionMatrix * vec4<f32>(endPointView, 1.0);

        let ndcOrigin = homogeneousOrigin.xyz / homogeneousOrigin.w;
        let ndcEndPoint = homogeneousEndPoint.xyz / homogeneousEndPoint.w;

        let uEndPoint = (ndcEndPoint.x * 0.5) + 0.5;
        let vEndPoint = 1 - ((ndcEndPoint.y * 0.5) + 0.5);

        let uOrigin = (ndcOrigin.x * 0.5) + 0.5;
        let vOrigin = 1 - ((ndcOrigin.y * 0.5) + 0.5);

        let uvOrigin = vec2<f32>(uOrigin, vOrigin);
        let uvEndPoint = vec2<f32>(uEndPoint, vEndPoint);

        let deltaUV = (uvEndPoint - uvOrigin) / f32(params.maxSteps);

        // linear interpolation of depth values in view space to avoid non-linearities in perspective projection
        let startViewZ = rayOriginView.z; 
        let endViewZ = endPointView.z;
        let startInvZ = 1.0 / startViewZ;
        let endInvZ = 1.0 / endViewZ;
        let deltaInvZ = (endInvZ - startInvZ) / f32(params.maxSteps);

        for(var step: u32 = 1u; step < params.maxSteps; step = step + 1u) {
            let currentRayUV = uvOrigin + deltaUV * f32(step);

            if (currentRayUV.x < 0.0 || currentRayUV.x > 1.0 || currentRayUV.y < 0.0 || currentRayUV.y > 1.0) {
                break; 
            }

            let currentRayInvZ = startInvZ + deltaInvZ * f32(step);
            let currentRayViewZ = 1.0 / currentRayInvZ;

            let currentSampleDepth = textureSampleLevel(depthTex, texSamplerNearest, currentRayUV, 0);
           
            let samplePixelCoords = vec2<u32>(currentRayUV * params.screenResolution);
            let currentViewSamplePos = getViewSpacePosition(samplePixelCoords, currentSampleDepth);

            let sampleDepth = currentViewSamplePos.z;
            let zDistance = abs(currentRayViewZ - sampleDepth);

            if(abs(currentRayViewZ) > abs(sampleDepth) && zDistance < params.thickness) {
                let lightOnImpact = textureSampleLevel(litSceneTex, texSamplerLinear, currentRayUV, 0.0);
                let normalOnImpact = textureSampleLevel(normalTex, texSamplerLinear, currentRayUV, 0.0).xyz;
                let normalViewOnImpact = normalize((params.viewMatrix * vec4<f32>(normalOnImpact, 0.0)).xyz);
                let attenuation = max(0.0, dot(sampleDirectionView, pixelNormalView)) * max(0.0, dot( -sampleDirectionView, normalViewOnImpact ));
                textureStore(ssgiOutput, pixelCoords, vec4<f32>(lightOnImpact.rgb * attenuation, 0.0));
                return;
            }
        }

        textureStore(ssgiOutput, pixelCoords, vec4<f32>(0.0,0.0,0.0,1.0));

        
    }

    fn getViewSpacePosition(pixelCoords: vec2<u32>, depth: f32) -> vec3<f32> {
        let ndcX = ((f32(pixelCoords.x) + 0.5) / params.screenResolution.x) * 2.0 - 1.0;
        let ndcY = 1.0 - ((f32(pixelCoords.y) + 0.5) / params.screenResolution.y) * 2.0;
        let viewPosH = (params.inverseProjectionMatrix * vec4<f32>(ndcX, ndcY, depth, 1.0));
        return viewPosH.xyz / viewPosH.w;
    }

    fn interleavedGradientNoisePixel(pixelCoords: vec2<f32>, frame: u32) -> f32 {
        let frameOffset = f32(frame % 16u) * 5.588238;
        let seed = pixelCoords + vec2<f32>(frameOffset, frameOffset);
        let magicVector = vec2<f32>(0.06711056, 0.00583715);
        return fract(52.9829189 * fract(dot(seed, magicVector)));
    }

   
  
`;