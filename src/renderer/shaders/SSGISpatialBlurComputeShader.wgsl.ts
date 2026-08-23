export const SSGISpatialBlurComputeShaderWGSL = `
    struct blurredSSGIParams {
        normalSharpness: f32,
        depthSharpness: f32,
        blurRadius: f32,
        stride: f32,
        screenResolution: vec2<f32>,
        zNear: f32,
        zFar: f32,
    };

    @group(0) @binding(0) var depthTex: texture_depth_2d;
    @group(0) @binding(1) var normalTex: texture_2d<f32>;
    @group(0) @binding(2) var inputTex: texture_2d<f32>;
    @group(0) @binding(3) var outputTex: texture_storage_2d<rgba16float, write>;

    @group(1) @binding(0) var<uniform> params: blurredSSGIParams;

    fn linearizeDepth(depth: f32, zNear: f32, zFar: f32) -> f32 {
        let zNdc = depth * 2.0 - 1.0;
        return (2.0 * zNear * zFar) / (zFar + zNear - zNdc * (zFar - zNear));
    }

    fn applyBlur(global_id: vec3<u32>, direction: vec2<i32>) {
        if (global_id.x >= u32(params.screenResolution.x) || global_id.y >= u32(params.screenResolution.y)) {
            return;
        }

        let pixelCoords = vec2<i32>(global_id.xy);
        let pixelDepth = textureLoad(depthTex, pixelCoords, 0);
        
        if(pixelDepth >= 1.0) {
            textureStore(outputTex, pixelCoords, vec4<f32>(0.0, 0.0, 0.0, 1.0));
            return;
        }

        let rawPixelNormal = textureLoad(normalTex, pixelCoords, 0).xyz;
        let pixelNormal = normalize(rawPixelNormal);
        let linearPixelDepth = linearizeDepth(pixelDepth, params.zNear, params.zFar);

        var colorAccum = vec4<f32>(0.0);
        var weightAccum = 0.0;
        
        let radius = i32(params.blurRadius);
        let safeRadius = max(params.blurRadius, 0.001);
        let sigma = safeRadius / 2.0; 
        let twoSigmaSq = 2.0 * sigma * sigma;

        for(var i: i32 = -radius; i <= radius; i = i + 1) {
            
            let sampleOffset = direction * (i * i32(params.stride));
            let sampleCoords = pixelCoords + sampleOffset;

            if (sampleCoords.x < 0 || sampleCoords.y < 0 || sampleCoords.x >= i32(params.screenResolution.x) || sampleCoords.y >= i32(params.screenResolution.y)) {
                continue;
            }

            let sampleDepth = textureLoad(depthTex, sampleCoords, 0);
            if (sampleDepth >= 1.0) {
                continue;
            }

            let sampleColor = textureLoad(inputTex, sampleCoords, 0);
            let rawSampleNormal = textureLoad(normalTex, sampleCoords, 0).xyz;
            let sampleNormal = normalize(rawSampleNormal);

            
            let normalDot = dot(pixelNormal, sampleNormal);
            let normalsWeight = pow(max(0.0, normalDot), params.normalSharpness);

            let distance = f32(i); 
            let distanceWeight = exp(-(distance * distance) / twoSigmaSq);

            let deltaDepth = abs(linearPixelDepth - linearizeDepth(sampleDepth, params.zNear, params.zFar));
            let depthWeight = exp(-deltaDepth * params.depthSharpness);

            let finalWeight = depthWeight * distanceWeight * normalsWeight;

            colorAccum += (sampleColor * finalWeight);
            weightAccum += finalWeight;
        }

        weightAccum = max(0.0001, weightAccum);
        textureStore(outputTex, pixelCoords, colorAccum / weightAccum);
    }

    @compute @workgroup_size(16, 16, 1)
    fn mainX(@builtin(global_invocation_id) global_id: vec3<u32>) {
        applyBlur(global_id, vec2<i32>(1, 0));
    }

    @compute @workgroup_size(16, 16, 1)
    fn mainY(@builtin(global_invocation_id) global_id: vec3<u32>) {
        applyBlur(global_id, vec2<i32>(0, 1));
    }
`;