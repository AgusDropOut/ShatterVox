export const GTAOBlurComputeShaderWGSL = `

    struct GTAOParams {
        screenResolution: vec2<f32>,
        zNear: f32,
        zFar: f32,
        inverseProjectionMatrix: mat4x4<f32>,
        projectionMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>,
    };



    @group(0) @binding(0) var depthTex: texture_depth_2d;
    @group(0) @binding(1) var noisyGTAO: texture_2d<f32>;
    @group(0) @binding(2) var blurredGTAO: texture_storage_2d<rgba8unorm, write>;

    @group(1) @binding(0) var<uniform> params: GTAOParams;

    const RADIUS: u32 = 3u; 
    const SPATIAL_WEIGHT: f32 = 1.0;
    const SHARPNESS: f32 = 500.0;
    

    @compute @workgroup_size(16, 16, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        if (global_id.x >= u32(params.screenResolution.x) || global_id.y >= u32(params.screenResolution.y)) {
            return;
        }

        let pixelCoords = vec2<i32>(global_id.xy);
        var dividend: f32 = 0.0;
        var divisor: f32 = 0.0;
        let pixelDepth = textureLoad(depthTex, pixelCoords, 0);
        let linearCenterDepth = linearizeDepth(pixelDepth, params.zNear, params.zFar);

        if(pixelDepth >= 1.0) {
            textureStore(blurredGTAO, pixelCoords, vec4<f32>(1.0, 0.0, 0.0, 1.0));
            return;
        }

        for (var offsetX: i32 = -i32(RADIUS); offsetX <= i32(RADIUS); offsetX++) {
            for (var offsetY: i32 = -i32(RADIUS); offsetY <= i32(RADIUS); offsetY++) {
                let sampleCoords = pixelCoords + vec2<i32>(offsetX, offsetY);

                if (sampleCoords.x < 0 || sampleCoords.y < 0 || sampleCoords.x >= i32(params.screenResolution.x) || sampleCoords.y >= i32(params.screenResolution.y)) {
                    continue;
                }

            
                let sampleDepth = textureLoad(depthTex, sampleCoords, 0);

                if (sampleDepth >= 1.0) {
                    continue;
                }
               
                
                let linearSampleDepth = linearizeDepth(sampleDepth, params.zNear, params.zFar);
                let depthDifference = abs(linearSampleDepth - linearCenterDepth);
                let depthWeight = max(0.0, 1.0 - (depthDifference * SHARPNESS));

                let sampleGTAO = textureLoad(noisyGTAO, sampleCoords, 0).r;
                dividend += sampleGTAO * depthWeight;
                divisor += depthWeight;

            }
        }

        divisor = max(divisor, 0.0001);
        let finalBlurredGTAO = dividend / divisor;
        textureStore(blurredGTAO, pixelCoords, vec4<f32>(finalBlurredGTAO, 0.0, 0.0, 1.0));
        
    }


    fn linearizeDepth(depth: f32, zNear: f32, zFar: f32) -> f32 {
        let zNdc = depth * 2.0 - 1.0;
        return (2.0 * zNear * zFar) / (zFar + zNear - zNdc * (zFar - zNear));
    }

 
  
`;