export const GTAOBlurComputeShaderWGSL = `
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

    @group(0) @binding(0) var depthTex: texture_depth_2d;
    @group(0) @binding(1) var inputTex: texture_2d<f32>;
    @group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;

    @group(1) @binding(0) var<uniform> params: GTAOParams;

    fn linearizeDepth(depth: f32, zNear: f32, zFar: f32) -> f32 {
        let zNdc = depth * 2.0 - 1.0;
        return (2.0 * zNear * zFar) / (zFar + zNear - zNdc * (zFar - zNear));
    }

    fn applyBlur(global_id: vec3<u32>, direction: vec2<i32>) {
        if (global_id.x >= u32(params.screenResolution.x) || global_id.y >= u32(params.screenResolution.y)) {
            return;
        }

        let pixelCoords = vec2<i32>(global_id.xy);
        var dividend: f32 = 0.0;
        var divisor: f32 = 0.0;
        
        let pixelDepth = textureLoad(depthTex, pixelCoords, 0);
        let linearCenterDepth = linearizeDepth(pixelDepth, params.zNear, params.zFar);

        if(pixelDepth >= 1.0) {
            textureStore(outputTex, pixelCoords, vec4<f32>(1.0, 0.0, 0.0, 1.0));
            return;
        }

        let radiusInt = i32(params.blurRadius);

        for (var i: i32 = -radiusInt; i <= radiusInt; i++) {
            let sampleCoords = pixelCoords + direction * i;

            if (sampleCoords.x < 0 || sampleCoords.y < 0 || sampleCoords.x >= i32(params.screenResolution.x) || sampleCoords.y >= i32(params.screenResolution.y)) {
                continue;
            }

            let sampleDepth = textureLoad(depthTex, sampleCoords, 0);

            if (sampleDepth >= 1.0) {
                continue;
            }
           
            let linearSampleDepth = linearizeDepth(sampleDepth, params.zNear, params.zFar);
            let depthDifference = abs(linearSampleDepth - linearCenterDepth);
            let depthWeight = max(0.0, 1.0 - (depthDifference * params.blurSharpness));

            let sampleValue = textureLoad(inputTex, sampleCoords, 0).r;
            dividend += sampleValue * depthWeight;
            divisor += depthWeight;
        }

        divisor = max(divisor, 0.0001);
        let finalValue = dividend / divisor;
        textureStore(outputTex, pixelCoords, vec4<f32>(finalValue, 0.0, 0.0, 1.0));
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