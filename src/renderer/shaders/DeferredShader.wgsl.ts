export const deferredShader = `
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
    };

    struct Camera {
        viewProj: mat4x4<f32>,
        invViewProj: mat4x4<f32>,
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

    @group(0) @binding(0) var texSamplerLinear: sampler;
    @group(0) @binding(1) var texSamplerNearest: sampler;
    @group(0) @binding(2) var albedoTex: texture_2d<f32>;
    @group(0) @binding(3) var normalTex: texture_2d<f32>;
    @group(0) @binding(4) var depthTex: texture_depth_2d;
    @group(1) @binding(0) var<uniform> camera: Camera;

    struct Light {
        position: vec3<f32>,
        intensity: f32,
        color: vec3<f32>,
        padding: f32,
    };
    
    @group(2) @binding(0) var<storage, read> lightBuffer: array<Light>;
    @group(2) @binding(1) var<uniform> lightInfo: vec4<f32>;
    

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let depth = textureSample(depthTex, texSamplerNearest, in.uv);
        if (depth >= 1.0) {
            return vec4<f32>(0.0, 0.3, 0.8, 1.0);
        }
        
        let albedo = textureSample(albedoTex, texSamplerLinear, in.uv);
        let normal = textureSample(normalTex, texSamplerLinear, in.uv);
        let normalizedNormal = normalize(normal.xyz);

        let xNDC = in.uv.x * 2.0 - 1.0;
        let yNDC = 1.0 - in.uv.y * 2.0;
        let zNDC = depth;

        let clip = vec4<f32>(xNDC, yNDC, zNDC, 1.0);
        let WHomogenous = camera.invViewProj * clip;
        let worldPos = WHomogenous.xyz / WHomogenous.w;

        var lightAccum: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);
        let lightCount = i32(lightInfo.x);

        for(var i: i32 = 0; i < lightCount; i = i + 1) {
            let light = lightBuffer[i];
            let lightDir = light.position - worldPos;
            let distance = length(lightDir);
            
            if (distance < light.intensity) {
                let ndir = normalize(lightDir);
                let diff = max(dot(normalizedNormal, ndir), 0.0);
                let attenuation = max(1.0 - ((distance * distance) / (light.intensity * light.intensity)), 0.0);
                lightAccum = lightAccum + (light.color * diff * attenuation);
            }
        }
        
        let ambient = vec3<f32>(0.2, 0.2, 0.2);
        let finalColor = albedo.xyz * (lightAccum + ambient);

        let mappedColor = finalColor / (finalColor + vec3<f32>(1.0, 1.0, 1.0));
        let gammaCorrectedColor = pow(mappedColor, vec3<f32>(1.0 / 2.2));
        return vec4<f32>(finalColor, albedo.w);
    }
`;