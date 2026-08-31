export const ParticleComputeShaderWGSL = `
    struct Particle {
        positionAndLife: vec4<f32>,
        velocityAndSize: vec4<f32>,
        color: vec4<f32>,
    };

    struct Params {
        screenResolution: vec2<f32>,
        inverseProjectionMatrix: mat4x4<f32>,
        projectionMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>,
        viewProjMatrix: mat4x4<f32>,
        prevViewProjMatrix: mat4x4<f32>, 
    };

    @group(0) @binding(0) var depthTex: texture_depth_2d;
    @group(0) @binding(1) var normalTex: texture_2d<f32>;

    @group(1) @binding(0) var<uniform> params: Params;
    @group(2) @binding(0) var<storage, read_write> particleBuffer: array<Particle>;

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
     
        if (global_id.x >= arrayLength(&particleBuffer)) {
            return;
        }

        var particle = particleBuffer[global_id.x];
        particle.positionAndLife.x += particle.velocityAndSize.x;
        particle.positionAndLife.y += particle.velocityAndSize.y;
        particle.positionAndLife.z += particle.velocityAndSize.z;
        particle.positionAndLife.w -= 1.0;

        if(particle.positionAndLife.w <= 0.0) {
            particle.positionAndLife = vec4<f32>(0.0, 0.0, 0.0, 0.0);
            particle.velocityAndSize = vec4<f32>(0.0, 0.0, 0.0, 0.000001);
            particleBuffer[global_id.x] = particle;
            return;
        }

        let clipPos = params.viewProjMatrix * vec4<f32>(particle.positionAndLife.xyz, 1.0);
        let screenPos = clipPos.xy / clipPos.w;
    

        let uv = vec2<f32>(
            (screenPos.x + 1.0) * 0.5, 
            (1.0 - screenPos.y) * 0.5 
        );
        let pixelCoords = vec2<i32>(uv * params.screenResolution);
        let pixelDepth = textureLoad(depthTex, pixelCoords, 0);
        
        if( pixelDepth < clipPos.z / clipPos.w && clipPos.z / clipPos.w < pixelDepth + 0.1) {
            let pixelNormalWorld = textureLoad(normalTex, pixelCoords, 0).xyz;
            let particleNormal = normalize(particle.velocityAndSize.xyz);
            let dotProduct = dot(particleNormal, pixelNormalWorld);
            _ = reflect(particle.velocityAndSize.xyz, pixelNormalWorld) * 0.001;

            particle.velocityAndSize[0] = particle.velocityAndSize[0] * 0.5;
            particle.velocityAndSize[1] = particle.velocityAndSize[1] * 0.5;
            particle.velocityAndSize[2] = particle.velocityAndSize[2] * 0.5;
            particle.velocityAndSize[1] = abs(particle.velocityAndSize[1]) * 0.5;
            particle.positionAndLife += particle.velocityAndSize;
        }

        

        particleBuffer[global_id.x] = particle;

        
    }
`;