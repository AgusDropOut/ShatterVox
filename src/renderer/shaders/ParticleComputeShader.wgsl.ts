export const ParticleComputeShaderWGSL = `
    struct Particle {
        positionAndLife: vec4<f32>,
        velocity: vec4<f32>,
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
    @group(2) @binding(0) var<storage, read> particleBuffer: array<Particle>;

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        // Prevención de dead-code elimination
        _ = params.screenResolution;
        _ = params.inverseProjectionMatrix;
        _ = params.projectionMatrix;
        _ = params.viewMatrix;
        _ = particleBuffer[0];
        _ = textureLoad(depthTex, vec2<i32>(0, 0), 0);
        _ = textureLoad(normalTex, vec2<i32>(0, 0), 0);

        if (global_id.x >= arrayLength(&particleBuffer)) {
            return;
        }

        // Lógica futura
    }
`;